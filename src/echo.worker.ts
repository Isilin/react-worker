// Simple echo / ping worker
// Receives messages and responds with structured objects

import { sendError, sendReady } from './lib/core/main';

const WORKER_ID = 'echo';

sendReady(WORKER_ID);

sendError(WORKER_ID, 'This is a test error message');

self.addEventListener('message', (e: MessageEvent) => {
  const data = e.data;
  if (data && typeof data === 'object' && data.type === 'PING') {
    self.postMessage({ type: 'PONG', at: Date.now() });
    return;
  }
  self.postMessage({ type: 'ECHO', payload: data, at: Date.now() });
});
