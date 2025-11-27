import log from 'loglevel';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Inbound,
  Outbound,
  WorkerCallbacks,
  WorkerStatus,
} from '../types/protocol';

interface WorkerInstance {
  id: string;
  worker: Worker;
  status: WorkerStatus;
  busy: boolean;
}

interface QueuedTask {
  id: string;
  message: Inbound;
  resolve: (result: Outbound) => void;
  reject: (error: Error) => void;
  timeout?: ReturnType<typeof setTimeout>;
}

interface Props {
  script: string | URL;
  poolSize?: number;
  options?: WorkerOptions;
  autostart?: boolean;
  timeout?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  callbacks?: WorkerCallbacks;
  warmup?: boolean; // Pre-initialize workers with PING (default: true)
}

interface WorkerPoolHook {
  start: () => void;
  postMessage: (message: Inbound) => Promise<Outbound>; // Returns a promise with the result
  terminate: () => void;
  restart: () => void;
  status: WorkerStatus; // Overall pool status
  availableWorkers: number; // Number of idle workers
  queueLength: number; // Number of queued tasks
}

if (!window.Worker) {
  throw new Error('Web Workers are not supported in this environment.');
}

export const useWorkerPool = ({
  script,
  poolSize = 4,
  options,
  autostart = false,
  timeout = 30000,
  logLevel = 'info',
  callbacks,
  warmup = true,
}: Props): WorkerPoolHook => {
  const workersRef = useRef<Map<string, WorkerInstance>>(new Map());
  const taskQueueRef = useRef<QueuedTask[]>([]);
  const [status, setStatus] = useState<WorkerStatus>('idle');
  const [availableWorkers, setAvailableWorkers] = useState(0);
  const [queueLength, setQueueLength] = useState(0);

  // Configure log level
  useEffect(() => {
    log.setLevel(logLevel);
  }, [logLevel]);

  const updateStats = useCallback(() => {
    const workers = Array.from(workersRef.current.values());
    const available = workers.filter(
      (w) => !w.busy && w.status === 'running',
    ).length;
    setAvailableWorkers(available);
    setQueueLength(taskQueueRef.current.length);

    // Update overall status
    if (workers.length === 0) {
      setStatus('idle');
    } else if (workers.every((w) => w.status === 'error')) {
      setStatus('error');
    } else if (workers.some((w) => w.status === 'running')) {
      setStatus('running');
    } else if (workers.some((w) => w.status === 'starting')) {
      setStatus('starting');
    }
  }, []);

  const processQueue = useCallback(() => {
    // Try to assign queued tasks to available workers
    while (taskQueueRef.current.length > 0) {
      const worker = Array.from(workersRef.current.values()).find(
        (w) => !w.busy && w.status === 'running',
      );

      if (!worker) break;

      const task = taskQueueRef.current.shift();
      if (!task) break;

      worker.busy = true;
      worker.worker.postMessage(task.message);

      log.debug(
        `[Worker Pool] Assigned task ${task.id} to worker ${worker.id}`,
      );
    }

    updateStats();
  }, [updateStats]);

  const createWorker = useCallback(
    (workerId: string): WorkerInstance | null => {
      try {
        const worker = new Worker(script, { type: 'module', ...options });
        const instance: WorkerInstance = {
          id: workerId,
          worker,
          status: 'starting',
          busy: false,
        };

        worker.addEventListener('message', (event: MessageEvent) => {
          const data = event.data as Outbound;

          switch (data.type) {
            case 'READY':
              instance.status = 'running';
              instance.busy = false;
              callbacks?.onReady?.();
              processQueue();
              break;

            case 'ERROR':
              log.error(`[Worker ${workerId}]`, data.reason);
              instance.status = 'error';
              instance.busy = false;
              callbacks?.onError?.(data.reason);

              // Find and reject pending task for this worker
              const errorTask = taskQueueRef.current.find(
                (t) => !t.timeout || t.timeout === null,
              );
              if (errorTask) {
                errorTask.reject(new Error(data.reason));
              }
              break;

            case 'WARNING':
              log.warn(`[Worker ${workerId}]`, data.reason);
              callbacks?.onWarning?.(data.reason);
              break;

            case 'TERMINATED':
              log.info(`[Worker ${workerId}] Terminated gracefully`);
              instance.status = 'idle';
              instance.busy = false;
              callbacks?.onTerminated?.();
              break;

            case 'HEALTH':
              callbacks?.onHealth?.(data.status, data.memory);
              if (data.status === 'degraded') {
                instance.status = 'warning';
              }
              break;

            case 'PROGRESS':
              callbacks?.onProgress?.(data.percent, data.message);
              break;

            case 'LOG':
              const logMethod = log[data.level] || log.info;
              logMethod(`[Worker ${workerId}]`, data.message, data.data || '');
              callbacks?.onLog?.(data.level, data.message, data.data);
              break;

            default:
              // For other message types (ACTED, ECHOED, PONG, etc.)
              // Find the corresponding task and resolve it
              instance.busy = false;
              processQueue();
              break;
          }

          updateStats();
        });

        worker.addEventListener('error', (error) => {
          log.error(`[Worker ${workerId}] Error:`, error);
          instance.status = 'error';
          instance.busy = false;
          updateStats();
        });

        workersRef.current.set(workerId, instance);
        return instance;
      } catch (error) {
        log.error(`Failed to create worker ${workerId}:`, error);
        return null;
      }
    },
    [script, options, callbacks, processQueue, updateStats],
  );

  const start = useCallback(() => {
    log.info(`[Worker Pool] Starting pool with ${poolSize} workers`);
    setStatus('starting');

    for (let i = 0; i < poolSize; i++) {
      const workerId = `worker-${i}`;
      createWorker(workerId);
    }

    updateStats();

    // Warm-up: send PING to all workers to reduce first message latency
    if (warmup) {
      setTimeout(() => {
        workersRef.current.forEach((instance) => {
          if (instance.status === 'running') {
            log.debug(`[Worker Pool] Warming up ${instance.id}`);
            instance.worker.postMessage({ type: 'PING' });
          }
        });
      }, 100); // Small delay to let workers initialize
    }
  }, [poolSize, createWorker, updateStats, warmup]);

  const terminate = useCallback(() => {
    log.info('[Worker Pool] Terminating all workers');
    setStatus('terminating');

    // Clear all queued tasks
    taskQueueRef.current.forEach((task) => {
      if (task.timeout) clearTimeout(task.timeout);
      task.reject(new Error('Worker pool terminated'));
    });
    taskQueueRef.current = [];

    // Terminate all workers
    workersRef.current.forEach((instance) => {
      instance.worker.terminate();
    });
    workersRef.current.clear();

    setStatus('idle');
    updateStats();
  }, [updateStats]);

  const restart = useCallback(() => {
    terminate();
    setTimeout(() => {
      start();
    }, 100);
  }, [terminate, start]);

  const postMessage = useCallback(
    (message: Inbound): Promise<Outbound> => {
      return new Promise((resolve, reject) => {
        const taskId = crypto.randomUUID();

        // Try to find an available worker immediately
        const availableWorker = Array.from(workersRef.current.values()).find(
          (w) => !w.busy && w.status === 'running',
        );

        const task: QueuedTask = {
          id: taskId,
          message,
          resolve,
          reject,
        };

        if (availableWorker) {
          // Execute immediately
          availableWorker.busy = true;
          availableWorker.worker.postMessage(message);

          // Set up response handler
          const handleResponse = (event: MessageEvent) => {
            const data = event.data as Outbound;
            // Only handle result messages
            if (
              data.type === 'ACTED' ||
              data.type === 'ECHOED' ||
              data.type === 'PONG'
            ) {
              availableWorker.worker.removeEventListener(
                'message',
                handleResponse,
              );
              if (task.timeout) clearTimeout(task.timeout);
              availableWorker.busy = false;
              resolve(data);
              processQueue();
            }
          };

          availableWorker.worker.addEventListener('message', handleResponse);

          // Set timeout
          if (timeout) {
            task.timeout = setTimeout(() => {
              availableWorker.worker.removeEventListener(
                'message',
                handleResponse,
              );
              availableWorker.busy = false;
              reject(new Error(`Task ${taskId} timeout after ${timeout}ms`));
              processQueue();
            }, timeout);
          }

          log.debug(`[Worker Pool] Task ${taskId} assigned immediately`);
        } else {
          // Queue the task
          taskQueueRef.current.push(task);
          log.debug(`[Worker Pool] Task ${taskId} queued`);

          // Set timeout for queued task
          if (timeout) {
            task.timeout = setTimeout(() => {
              const index = taskQueueRef.current.findIndex(
                (t) => t.id === taskId,
              );
              if (index !== -1) {
                taskQueueRef.current.splice(index, 1);
                reject(new Error(`Task ${taskId} timeout in queue`));
              }
            }, timeout);
          }
        }

        updateStats();
      });
    },
    [timeout, processQueue, updateStats],
  );

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
    terminate,
    restart,
    status,
    availableWorkers,
    queueLength,
  };
};
