import type {
  Inbound,
  LogLevel,
  Outbound,
  StandardInbound,
} from '../types/protocol';

/**
 * Send a message from worker to main thread
 */
export function send(worker: string, message: Outbound): void {
  self.postMessage({ ...message, worker, at: Date.now() });
}

/**
 * Send ready notification to main thread
 */
export function sendReady(worker: string): void {
  send(worker, { type: 'READY' });
}

/**
 * Send echoed result to main thread
 */
export function sendEchoed(
  worker: string,
  payload: string,
  extra?: { durationMs?: number },
): void {
  send(worker, { type: 'ECHOED', payload, ...(extra || {}) });
}

/**
 * Send action result to main thread
 */
export function sendActed(
  worker: string,
  result: unknown,
  extra?: { durationMs?: number },
): void {
  send(worker, { type: 'ACTED', result, ...(extra || {}) });
}

export function sendError(worker: string, reason: string): void {
  send(worker, { type: 'ERROR', reason });
}

/**
 * Send PONG response to main thread
 */
export function sendPong(worker: string): void {
  send(worker, { type: 'PONG' });
}

/**
 * Send terminated notification to main thread
 */
export function sendTerminated(worker: string): void {
  send(worker, { type: 'TERMINATED' });
}

/**
 * Send health status to main thread
 */
export function sendHealth(
  worker: string,
  status: 'healthy' | 'degraded',
): void {
  send(worker, { type: 'HEALTH', status });
}

/**
 * Send progress update to main thread
 */
export function sendProgress(
  worker: string,
  percent: number,
  message?: string,
): void {
  send(worker, { type: 'PROGRESS', percent, message });
}

/**
 * Send log message to main thread
 */
export function sendLog(
  worker: string,
  level: LogLevel,
  message: string,
  data?: unknown,
): void {
  send(worker, { type: 'LOG', level, message, data });
}

/**
 * Send a stream chunk to main thread
 */
export function sendStreamChunk(
  worker: string,
  streamId: string,
  chunkIndex: number,
  totalChunks: number,
  data: unknown,
): void {
  send(worker, {
    type: 'STREAM_CHUNK',
    streamId,
    chunkIndex,
    totalChunks,
    data,
  });
}

/**
 * Send stream complete notification to main thread
 */
export function sendStreamComplete(worker: string, streamId: string): void {
  send(worker, { type: 'STREAM_COMPLETE', streamId });
}

/**
 * Send stream error notification to main thread
 */
export function sendStreamError(
  worker: string,
  streamId: string,
  error: string,
): void {
  send(worker, { type: 'STREAM_ERROR', streamId, error });
}

/**
 * Subscribe to messages from main thread (inside worker)
 */
export function receiveFromMain<TCustom = never>(
  callback: (message: Inbound<TCustom>) => void,
): () => void {
  const handler = (e: MessageEvent<Inbound<TCustom>>) => {
    callback(e.data);
  };
  self.addEventListener('message', handler);
  return () => self.removeEventListener('message', handler);
}

/**
 * Handle incoming messages with type-based routing (inside worker)
 */
export function onMainMessage<TPayload = unknown, TCustom = never>(handlers: {
  onPing?: () => void;
  onEcho?: (payload: string) => void;
  onAction?: (payload: TPayload) => void;
  onTerminate?: () => void;
  onHealthCheck?: () => void;
  onError?: (error: Error) => void;
  onCustom?: (message: TCustom) => void;
}): () => void {
  return receiveFromMain<TCustom>((msg) => {
    try {
      const standardMsg = msg as StandardInbound;
      switch (standardMsg.type) {
        case 'ECHO':
          handlers.onEcho?.(standardMsg.payload);
          break;
        case 'ACTION':
          handlers.onAction?.(standardMsg.payload as TPayload);
          break;
        case 'PING':
          handlers.onPing?.();
          break;
        case 'TERMINATE':
          handlers.onTerminate?.();
          break;
        case 'HEALTH_CHECK':
          handlers.onHealthCheck?.();
          break;
        default:
          // Handle custom messages
          if (handlers.onCustom) {
            handlers.onCustom(msg as TCustom);
          } else {
            throw new Error(`Unknown message type in ${JSON.stringify(msg)}`);
          }
      }
    } catch (error) {
      if (handlers.onError) {
        handlers.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  });
}
