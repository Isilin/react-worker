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

// Send initial health check
(async () => {
  sendHealth(WORKER_ID, 'healthy');
})();

onMainMessage({
  onPing: () => {
    sendPong(WORKER_ID);
    sendLog(WORKER_ID, 'debug', 'PING received, PONG sent');
  },
  onEcho: (payload) => {
    const t0 = performance.now();
    // Echo is trivial, but we still measure
    const out = payload;
    const durationMs = performance.now() - t0;
    sendEchoed(WORKER_ID, out, { durationMs });
    sendLog(WORKER_ID, 'debug', `Echoed: ${payload}`);
  },
  onTerminate: () => {
    sendLog(WORKER_ID, 'info', 'Terminating echo worker');
    sendTerminated(WORKER_ID);
    self.close();
  },
  onHealthCheck: async () => {
    sendHealth(WORKER_ID, 'healthy');
  },
});
