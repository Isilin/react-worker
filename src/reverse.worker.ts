// Reverse worker
// Receives messages and reverses strings or array contents

import { sendReady } from './lib/core/main';

const WORKER_ID = 'reverse';

sendReady(WORKER_ID);

self.addEventListener('message', (e: MessageEvent) => {
  const data = e.data;

  if (data && typeof data === 'object' && data.type === 'PING') {
    self.postMessage({ type: 'PONG', worker: 'REVERSE', at: Date.now() });
    return;
  }

  // If it's a string, reverse it
  if (typeof data === 'string') {
    self.postMessage({
      type: 'REVERSED',
      original: data,
      result: data.split('').reverse().join(''),
      at: Date.now(),
    });
    return;
  }

  // If it's an array, reverse it
  if (Array.isArray(data)) {
    self.postMessage({
      type: 'REVERSED',
      original: data,
      result: [...data].reverse(),
      at: Date.now(),
    });
    return;
  }

  // For other types, just echo with a REVERSED type
  self.postMessage({ type: 'REVERSED', payload: data, at: Date.now() });
});
