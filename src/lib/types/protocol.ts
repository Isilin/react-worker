export type WorkerStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'error'
  | 'warning'
  | 'terminating';

// Message entered into the worker from main
export type Inbound =
  | { type: 'ECHO'; payload: string }
  | { type: 'ACTION'; payload: unknown };

// Message sent from the worker back to main
export type Outbound =
  | { type: 'READY' }
  | { type: 'ERROR' | 'WARNING'; reason: string }
  | { type: 'ECHOED'; payload: string }
  | { type: 'ACTED'; result: unknown };
