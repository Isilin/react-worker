export type WorkerStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'error'
  | 'warning'
  | 'terminating';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Standard messages from main to worker
export type StandardInbound =
  | { type: 'ECHO'; payload: string }
  | { type: 'ACTION'; payload: unknown }
  | { type: 'PING' }
  | { type: 'TERMINATE' }
  | { type: 'HEALTH_CHECK' };

// Standard messages from worker to main
export type StandardOutbound =
  | { type: 'READY' }
  | { type: 'ERROR' | 'WARNING'; reason: string }
  | { type: 'ECHOED'; payload: string; durationMs?: number }
  | { type: 'ACTED'; result: unknown; durationMs?: number }
  | { type: 'PONG' }
  | { type: 'TERMINATED' }
  | { type: 'HEALTH'; status: 'healthy' | 'degraded'; memory?: number }
  | { type: 'PROGRESS'; percent: number; message?: string }
  | { type: 'LOG'; level: LogLevel; message: string; data?: unknown }
  | {
      type: 'STREAM_CHUNK';
      streamId: string;
      chunkIndex: number;
      totalChunks: number;
      data: unknown;
    }
  | { type: 'STREAM_COMPLETE'; streamId: string }
  | { type: 'STREAM_ERROR'; streamId: string; error: string };

// Extensible message types for custom implementations
export interface CustomMessage<T extends string = string, P = unknown> {
  type: T;
  payload?: P;
}

// Message entered into the worker from main (extensible)
export type Inbound<TCustom = never> =
  | StandardInbound
  | ([TCustom] extends [never] ? never : TCustom);

// Message sent from the worker back to main (extensible)
export type Outbound<TCustom = never> =
  | StandardOutbound
  | ([TCustom] extends [never] ? never : TCustom);

// Callbacks for worker events
export interface WorkerCallbacks {
  onReady?: () => void;
  onError?: (reason: string) => void;
  onWarning?: (reason: string) => void;
  onTerminated?: () => void;
  onProgress?: (percent: number, message?: string) => void;
  onHealth?: (status: 'healthy' | 'degraded', memory?: number) => void;
  onPong?: () => void;
  onLog?: (level: LogLevel, message: string, data?: unknown) => void;
  onStreamChunk?: (
    streamId: string,
    chunkIndex: number,
    totalChunks: number,
    data: unknown,
  ) => void;
  onStreamComplete?: (streamId: string, data: unknown[]) => void;
  onStreamError?: (streamId: string, error: string) => void;
}

// Metrics for worker monitoring
export interface WorkerMetrics {
  messagesSent: number;
  messagesReceived: number;
  uptime: number; // milliseconds since start
  lastActivity: number; // timestamp of last message
  averageResponseTime: number; // milliseconds
  performance: {
    cpuTime?: number; // milliseconds of CPU time
    throughputPerMin?: number;
    healthStatus?: 'healthy' | 'degraded';
    lastHealthCheck?: number; // timestamp
  };
}
