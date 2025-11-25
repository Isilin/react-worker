// Reverse worker
// Receives messages and reverses strings or array contents

import {
  onMainMessage,
  sendActed,
  sendHealth,
  sendLog,
  sendPong,
  sendProgress,
  sendReady,
  sendTerminated,
} from './lib/core/main';

const WORKER_ID = 'reverse';

sendReady(WORKER_ID);
sendLog(WORKER_ID, 'info', 'Reverse worker initialized');

// Simulate periodic health check
setInterval(() => {
  const memory = (
    performance as unknown as { memory?: { usedJSHeapSize: number } }
  ).memory?.usedJSHeapSize;
  sendHealth(WORKER_ID, 'healthy', memory);
}, 7000);

onMainMessage({
  onPing: () => {
    sendPong(WORKER_ID);
    sendLog(WORKER_ID, 'debug', 'PING received, PONG sent');
  },
  onAction: (payload) => {
    sendLog(WORKER_ID, 'debug', 'Processing action', payload);
    
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
      result = [...payload].reverse();
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

    sendActed(WORKER_ID, result);
  },
  onTerminate: () => {
    sendLog(WORKER_ID, 'info', 'Terminating reverse worker');
    sendTerminated(WORKER_ID);
    self.close();
  },
  onHealthCheck: () => {
    const memory = (
      performance as unknown as { memory?: { usedJSHeapSize: number } }
    ).memory?.usedJSHeapSize;
    sendHealth(WORKER_ID, 'healthy', memory);
  },
});
