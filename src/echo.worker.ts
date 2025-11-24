// Simple echo / ping worker
// Receives messages and responds with structured objects

self.postMessage({ type: 'READY', at: Date.now() });

self.addEventListener('message', (e: MessageEvent) => {
  const data = e.data;
  if (data && typeof data === 'object' && data.type === 'PING') {
    self.postMessage({ type: 'PONG', at: Date.now() });
    return;
  }
  self.postMessage({ type: 'ECHO', payload: data, at: Date.now() });
});
