export type WorkerStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'error'
  | 'warning'
  | 'terminating';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Message entered into the worker from main
export type Inbound =
  | { type: 'ECHO'; payload: string }
  | { type: 'ACTION'; payload: unknown }
  | { type: 'PING' }
  | { type: 'TERMINATE' }
  | { type: 'HEALTH_CHECK' };

// Message sent from the worker back to main
export type Outbound =
  | { type: 'READY' }
  | { type: 'ERROR' | 'WARNING'; reason: string }
  | { type: 'ECHOED'; payload: string }
  | { type: 'ACTED'; result: unknown }
  | { type: 'PONG' }
  | { type: 'TERMINATED' }
  | { type: 'HEALTH'; status: 'healthy' | 'degraded'; memory?: number }
  | { type: 'PROGRESS'; percent: number; message?: string }
  | { type: 'LOG'; level: LogLevel; message: string; data?: unknown };
