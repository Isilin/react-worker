import type { Inbound, LogLevel, Outbound } from '../types/protocol';

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
export function sendEchoed(worker: string, payload: string): void {
  send(worker, { type: 'ECHOED', payload });
}

/**
 * Send action result to main thread
 */
export function sendActed(worker: string, result: unknown): void {
  send(worker, { type: 'ACTED', result });
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
  memory?: number,
): void {
  send(worker, { type: 'HEALTH', status, memory });
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
 * Subscribe to messages from main thread (inside worker)
 */
export function receiveFromMain(
  callback: (message: Inbound) => void,
): () => void {
  const handler = (e: MessageEvent<Inbound>) => {
    callback(e.data);
  };
  self.addEventListener('message', handler);
  return () => self.removeEventListener('message', handler);
}

/**
 * Handle incoming messages with type-based routing (inside worker)
 */
export function onMainMessage(handlers: {
  onPing?: () => void;
  onEcho?: (payload: string) => void;
  onAction?: (payload: unknown) => void;
  onTerminate?: () => void;
  onHealthCheck?: () => void;
}): () => void {
  return receiveFromMain((msg) => {
    switch (msg.type) {
      case 'ECHO':
        handlers.onEcho?.(msg.payload);
        break;
      case 'ACTION':
        handlers.onAction?.(msg.payload);
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
    }
  });
}
