// Reverse worker
// Receives messages and reverses strings or array contents

import log from 'loglevel';

import {
  onMainMessage,
  sendActed,
  sendEchoed,
  sendHealth,
  sendLog,
  sendPong,
  sendProgress,
  sendReady,
  sendTerminated,
} from './lib/core/main';

// Configure loglevel to show all messages including debug
log.setLevel('ERROR');

const WORKER_ID = 'reverse';

// Allocate some memory to make this worker use more heap
// Create a large array to simulate data processing
const largeDataCache: string[] = [];
for (let i = 0; i < 100000; i++) {
  largeDataCache.push(
    `Data item ${i} with some additional text to use more memory`,
  );
}

sendReady(WORKER_ID);
sendLog(WORKER_ID, 'info', 'Reverse worker initialized');
sendLog(
  WORKER_ID,
  'debug',
  `Allocated ${largeDataCache.length} items in cache`,
);

// Send initial health check
(async () => {
  sendHealth(WORKER_ID, 'healthy');
})();

onMainMessage({
  onPing: () => {
    sendPong(WORKER_ID);
    sendLog(WORKER_ID, 'debug', 'PING received, PONG sent');
  },
  onAction: (payload) => {
    sendLog(WORKER_ID, 'debug', 'Processing action', payload);
    const t0 = performance.now();

    // Add some items to cache to increase memory usage
    for (let i = 0; i < 1000; i++) {
      largeDataCache.push(`Processed item ${i}: ${String(payload)}`);
    }

    // Simulate progress for long operations
    if (typeof payload === 'string' && payload.length > 10) {
      sendProgress(WORKER_ID, 50, 'Processing...');
      setTimeout(() => {
        sendProgress(WORKER_ID, 100, 'Complete');
      }, 100);
    }

    let result: unknown;

    // If it's a string, reverse it
    if (typeof payload === 'string') {
      result = payload.split('').reverse().join('');
      sendLog(WORKER_ID, 'debug', `Reversed string: ${payload} → ${result}`);
    }
    // If it's an array, reverse it
    else if (Array.isArray(payload)) {
      result = payload.slice().reverse();
      sendLog(WORKER_ID, 'debug', 'Reversed array', {
        original: payload,
        result,
      });
    }
    // For other types, just return as-is
    else {
      result = payload;
      sendLog(WORKER_ID, 'warn', 'Unknown payload type, returning as-is');
    }

    const durationMs = performance.now() - t0;
    sendActed(WORKER_ID, result, { durationMs });
  },
  onEcho: (payload) => {
    const t0 = performance.now();
    const reversed = payload.split('').reverse().join('');
    const durationMs = performance.now() - t0;
    sendEchoed(WORKER_ID, reversed, { durationMs });
    sendLog(WORKER_ID, 'debug', `Echoed: ${reversed}`);
  },
  onTerminate: () => {
    sendLog(WORKER_ID, 'info', 'Terminating reverse worker');
    sendTerminated(WORKER_ID);
    self.close();
  },
  onHealthCheck: async () => {
    sendHealth(WORKER_ID, 'healthy');
  },
});
