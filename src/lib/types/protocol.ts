export type WorkerStatus = 'idle' | 'starting' | 'running' | 'terminating';

// Message entered into the worker from main
export type Inbound =
  | { type: 'PING' }
  | { type: 'ECHO'; payload: string }
  | { type: 'ACTION'; payload: unknown };

// Message sent from the worker back to main
export type Outbound =
  | { type: 'READY' }
  | { type: 'PONG' }
  | { type: 'ECHOED'; payload: string }
  | { type: 'ACTED'; result: unknown };
