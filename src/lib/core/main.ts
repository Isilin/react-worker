import type { Inbound, Outbound } from '../types/protocol';

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
}): () => void {
  return receiveFromMain((msg) => {
    switch (msg.type) {
      case 'ECHO':
        handlers.onEcho?.(msg.payload);
        break;
      case 'ACTION':
        handlers.onAction?.(msg.payload);
        break;
    }
  });
}
