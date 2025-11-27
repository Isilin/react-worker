import log from 'loglevel';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Inbound,
  Outbound,
  WorkerCallbacks,
  WorkerMetrics,
  WorkerStatus,
} from '../types/protocol';
import { StreamCollector } from '../utils/data-stream';

interface Props {
  script: string | URL; // Allow passing a URL via import.meta.url for bundlers like Vite
  options?: WorkerOptions;
  autostart?: boolean;
  timeout?: number; // Timeout for operations in milliseconds
  logLevel?: 'debug' | 'info' | 'warn' | 'error'; // Configure log level
  callbacks?: WorkerCallbacks; // Event callbacks
  keepAlive?: boolean; // Keep worker alive indefinitely (default: true)
  idleTimeout?: number; // Timeout before termination if inactive (milliseconds, default: 60000)
}

interface WorkerHook {
  start: () => void;
  postMessage: (message: Inbound) => void; // Main to Worker message
  onMessage: (
    handler: (event: MessageEvent<Outbound>) => void, // Worker to Main message
  ) => () => void;
  terminate: () => void;
  restart: () => void; // Restart the worker
  status: WorkerStatus;
  error: Error | null; // Last error
  metrics: WorkerMetrics; // Performance metrics
}

if (!window.Worker) {
  throw new Error('Web Workers are not supported in this environment.');
}

export const useWorker = ({
  script,
  options,
  autostart = false,
  timeout,
  logLevel = 'info',
  callbacks,
  keepAlive = true,
  idleTimeout = 60000,
}: Props): WorkerHook => {
  const worker = useRef<Worker | null>(null);
  const listenersRef = useRef<Set<(event: MessageEvent) => void>>(new Set());
  const [status, setStatus] = useState<WorkerStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(
    null,
  );

  // Metrics tracking
  const metricsRef = useRef<WorkerMetrics>({
    messagesSent: 0,
    messagesReceived: 0,
    uptime: 0,
    lastActivity: 0,
    averageResponseTime: 0,
    performance: {},
  });
  const [metrics, setMetrics] = useState<WorkerMetrics>(metricsRef.current);
  const startTimeRef = useRef<number>(0);
  const pendingMessagesRef = useRef<Map<number, number>>(new Map());
  const messageIdCounter = useRef<number>(0);
  const responseTimes = useRef<number[]>([]);
  const processingTimes = useRef<number[]>([]);
  const recentResponses = useRef<Array<{ t: number; d?: number }>>([]);

  // Stream collector for reassembling streamed data
  const streamCollectorRef = useRef<StreamCollector>(
    new StreamCollector((streamId, data) => {
      callbacks?.onStreamComplete?.(streamId, data);
    }),
  );

  // Update metrics state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (worker.current && startTimeRef.current > 0) {
        metricsRef.current.uptime = Date.now() - startTimeRef.current;
        setMetrics({ ...metricsRef.current });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateMetrics = useCallback(() => {
    setMetrics({ ...metricsRef.current });
  }, []);

  // Configure log level
  useEffect(() => {
    log.setLevel(logLevel);
  }, [logLevel]);

  const terminate = useCallback(() => {
    setStatus('terminating');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    // Remove internal message handler
    if (messageHandlerRef.current && worker.current) {
      worker.current.removeEventListener('message', messageHandlerRef.current);
      messageHandlerRef.current = null;
    }
    worker.current?.terminate();
    worker.current = null;
    startTimeRef.current = 0;
    setStatus('idle');
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (!keepAlive && idleTimeout > 0) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        log.info('[Worker] Idle timeout reached, terminating worker');
        if (worker.current) {
          terminate();
        }
      }, idleTimeout);
    }
  }, [keepAlive, idleTimeout, terminate]);

  const start = useCallback(() => {
    if (worker.current) {
      terminate();
    }

    try {
      setStatus('starting');
      setError(null);
      startTimeRef.current = Date.now();

      // Reset metrics
      metricsRef.current = {
        messagesSent: 0,
        messagesReceived: 0,
        uptime: 0,
        lastActivity: Date.now(),
        averageResponseTime: 0,
        performance: {},
      };
      responseTimes.current = [];
      pendingMessagesRef.current.clear();
      setMetrics({ ...metricsRef.current });

      worker.current = new Worker(script, { type: 'module', ...options });

      // Create a stable message handler
      const messageHandler = (event: MessageEvent) => {
        const data = event.data as Outbound;

        // Update metrics
        metricsRef.current.messagesReceived++;
        metricsRef.current.lastActivity = Date.now();

        // Track response time if this is a response to a tracked message
        if (
          data.type === 'ACTED' ||
          data.type === 'ECHOED' ||
          data.type === 'PONG'
        ) {
          const messageId = messageIdCounter.current - 1;
          const sentTime = pendingMessagesRef.current.get(messageId);
          if (sentTime) {
            const responseTime = Date.now() - sentTime;
            responseTimes.current.push(responseTime);
            pendingMessagesRef.current.delete(messageId);

            // Keep only last 100 response times
            if (responseTimes.current.length > 100) {
              responseTimes.current.shift();
            }

            // Calculate average response time
            metricsRef.current.averageResponseTime =
              responseTimes.current.reduce((a, b) => a + b, 0) /
              responseTimes.current.length;
          }

          // Capture processing duration if provided by worker
          const durationMs = (data as Partial<{ durationMs: number }>)
            .durationMs;
          recentResponses.current.push({ t: Date.now(), d: durationMs });
          // Prune entries older than 60s
          const windowStart = Date.now() - 60000;
          while (
            recentResponses.current.length &&
            recentResponses.current[0].t < windowStart
          ) {
            recentResponses.current.shift();
          }

          // Throughput = responses in last minute
          metricsRef.current.performance.throughputPerMin =
            recentResponses.current.length;

          // Keep processing stats
          if (typeof durationMs === 'number' && !Number.isNaN(durationMs)) {
            processingTimes.current.push(durationMs);
            if (processingTimes.current.length > 100) {
              processingTimes.current.shift();
            }
          }
        }

        // Clear timeout on any response
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Reset idle timer on activity
        resetIdleTimer();

        switch (data.type) {
          case 'READY':
            setStatus('running');
            callbacks?.onReady?.();
            break;
          case 'ERROR':
            log.error('[Worker Error]', data.reason);
            setError(new Error(data.reason));
            callbacks?.onError?.(data.reason);
            terminate();
            setStatus('error');
            break;
          case 'WARNING':
            log.warn('[Worker Warning]', data.reason);
            callbacks?.onWarning?.(data.reason);
            setStatus('warning');
            break;
          case 'PONG':
            log.debug('[Worker] PONG received');
            callbacks?.onPong?.();
            break;
          case 'TERMINATED':
            log.info('[Worker] Terminated gracefully');
            callbacks?.onTerminated?.();
            setStatus('idle');
            break;
          case 'HEALTH':
            // Use memory reported by the worker itself
            log.debug(
              '[Worker Health]',
              data.status,
              data.memory
                ? `Memory: ${(data.memory / 1024 / 1024).toFixed(2)} MB`
                : 'Memory: N/A',
            );
            metricsRef.current.performance.healthStatus = data.status;
            metricsRef.current.performance.lastHealthCheck = Date.now();
            callbacks?.onHealth?.(data.status, data.memory);
            if (data.status === 'degraded') {
              setStatus('warning');
            }
            break;
          case 'PROGRESS':
            log.debug(`[Worker Progress] ${data.percent}%`, data.message || '');
            callbacks?.onProgress?.(data.percent, data.message);
            break;
          case 'LOG':
            const logMethod = log[data.level] || log.info;
            logMethod('[Worker Log]', data.message, data.data || '');
            callbacks?.onLog?.(data.level, data.message, data.data);
            break;
          case 'STREAM_CHUNK':
            log.debug(
              `[Worker Stream] Chunk ${data.chunkIndex + 1}/${data.totalChunks} for stream ${data.streamId}`,
            );
            streamCollectorRef.current.addChunk({
              id: data.streamId,
              chunkIndex: data.chunkIndex,
              totalChunks: data.totalChunks,
              data: data.data,
              timestamp: Date.now(),
            });
            callbacks?.onStreamChunk?.(
              data.streamId,
              data.chunkIndex,
              data.totalChunks,
              data.data,
            );
            break;
          case 'STREAM_COMPLETE':
            log.debug(`[Worker Stream] Stream ${data.streamId} completed`);
            // Callback already handled by StreamCollector
            break;
          case 'STREAM_ERROR':
            log.error(
              `[Worker Stream] Error in stream ${data.streamId}:`,
              data.error,
            );
            callbacks?.onStreamError?.(data.streamId, data.error);
            streamCollectorRef.current.clearStream(data.streamId);
            break;
          default:
            break;
        }

        updateMetrics();

        // Notify all registered listeners
        listenersRef.current.forEach((handler) => {
          handler(event);
        });
      };

      messageHandlerRef.current = messageHandler;
      worker.current.addEventListener('message', messageHandler);

      // Set timeout for worker initialization if specified
      if (timeout) {
        timeoutRef.current = setTimeout(() => {
          const timeoutError = new Error(
            `Worker initialization timeout after ${timeout}ms`,
          );
          log.error(timeoutError.message);
          setError(timeoutError);
          callbacks?.onError?.(timeoutError.message);
          terminate();
          setStatus('error');
        }, timeout);
      }

      // Start idle timer
      resetIdleTimer();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create worker';
      const workerError = new Error(errorMessage);
      setError(workerError);
      callbacks?.onError?.(errorMessage);

      if (err instanceof DOMException && err.name === 'SecurityError') {
        log.error(
          'SecurityError: Failed to create worker due to security restrictions',
          err,
        );
      } else if (err instanceof DOMException && err.name === 'NetworkError') {
        log.error('NetworkError: Failed to load worker script', err);
      } else if (err instanceof SyntaxError) {
        log.error('SyntaxError: Invalid worker script', err);
      } else {
        log.error('Failed to create worker', err);
      }
      setStatus('error');
    }
  }, [
    script,
    options,
    timeout,
    callbacks,
    terminate,
    resetIdleTimer,
    updateMetrics,
  ]);

  const restart = useCallback(() => {
    terminate();
    // Small delay to ensure cleanup
    setTimeout(() => {
      start();
    }, 100);
  }, [terminate, start]);

  // Send message to Worker
  const postMessage = useCallback(
    (message: Inbound) => {
      if (!worker.current) {
        log.warn('Cannot send message: worker is not running');
        return;
      }

      // Track message for response time calculation
      const messageId = messageIdCounter.current++;
      pendingMessagesRef.current.set(messageId, Date.now());

      // Update metrics
      metricsRef.current.messagesSent++;
      metricsRef.current.lastActivity = Date.now();
      updateMetrics();

      worker.current.postMessage(message);

      // Reset idle timer on activity
      resetIdleTimer();
    },
    [resetIdleTimer, updateMetrics],
  );

  // On message from Worker
  const onMessage = useCallback((handler: (event: MessageEvent) => void) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (autostart) {
      start();
    }
    return () => {
      terminate();
    };
  }, [autostart, start, terminate]);

  return {
    start,
    postMessage,
    onMessage,
    terminate,
    restart,
    status,
    error,
    metrics,
  };
};
