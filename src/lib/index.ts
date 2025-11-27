// Core hooks
export { useWorkerPool } from './core/worker-pool.hook';
export { useWorker } from './core/worker.hook';

// Worker-side utilities
export {
  onMainMessage,
  receiveFromMain,
  send,
  sendActed,
  sendEchoed,
  sendError,
  sendHealth,
  sendLog,
  sendPong,
  sendProgress,
  sendReady,
  sendStreamChunk,
  sendStreamComplete,
  sendStreamError,
  sendTerminated,
} from './core/main';

// Data streaming utilities
export {
  chunkDataBySize,
  DataStream,
  estimateDataSize,
  StreamCollector,
  type StreamChunk,
  type StreamOptions,
} from './utils/data-stream';

export {
  chunkByCount,
  chunkBySize,
  estimateSize,
  streamData,
  WorkerDataStream,
  type WorkerStreamOptions,
} from './utils/worker-stream';

// Types
export type {
  CustomMessage,
  Inbound,
  LogLevel,
  Outbound,
  StandardInbound,
  StandardOutbound,
  WorkerCallbacks,
  WorkerMetrics,
  WorkerStatus,
} from './types/protocol';
