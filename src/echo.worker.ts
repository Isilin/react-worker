// Simple echo / ping worker
// Receives messages and responds with structured objects

import {
  onMainMessage,
  sendEchoed,
  sendHealth,
  sendLog,
  sendPong,
  sendReady,
  sendTerminated,
} from './lib/core/main';

const WORKER_ID = 'echo';

sendReady(WORKER_ID);
sendLog(WORKER_ID, 'info', 'Echo worker initialized');

// Simulate health check
setInterval(() => {
  const memory = (
    performance as unknown as { memory?: { usedJSHeapSize: number } }
  ).memory?.usedJSHeapSize;
  sendHealth(WORKER_ID, 'healthy', memory);
}, 5000);

onMainMessage({
  onPing: () => {
    sendPong(WORKER_ID);
    sendLog(WORKER_ID, 'debug', 'PING received, PONG sent');
  },
  onEcho: (payload) => {
    sendEchoed(WORKER_ID, payload);
    sendLog(WORKER_ID, 'debug', `Echoed: ${payload}`);
  },
  onTerminate: () => {
    sendLog(WORKER_ID, 'info', 'Terminating echo worker');
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
