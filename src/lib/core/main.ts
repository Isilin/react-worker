import type { Inbound, Outbound } from '../types/protocol';

/**
 * Send a message from worker to main thread
 */
export function send(message: Outbound): void {
  self.postMessage(message);
}

/**
 * Send ready notification to main thread
 */
export function sendReady(): void {
  send({ type: 'READY' });
}

/**
 * Send pong response to main thread
 */
export function sendPong(): void {
  send({ type: 'PONG' });
}

/**
 * Send echoed result to main thread
 */
export function sendEchoed(payload: string): void {
  send({ type: 'ECHOED', payload });
}

/**
 * Send action result to main thread
 */
export function sendActed(result: unknown): void {
  send({ type: 'ACTED', result });
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
      case 'PING':
        handlers.onPing?.();
        break;
      case 'ECHO':
        handlers.onEcho?.(msg.payload);
        break;
      case 'ACTION':
        handlers.onAction?.(msg.payload);
        break;
    }
  });
}
