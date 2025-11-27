import type { FC } from 'react';

import type { WorkerMetrics } from './lib/types/protocol';
import { StreamingControls } from './StreamingControls';
import { StreamingProgress } from './StreamingProgress';
import styles from './StreamingSection.module.css';
import { StreamingStats } from './StreamingStats';

export interface StreamingSectionProps {
  // Worker metrics
  metrics: WorkerMetrics;
  status: string;

  // Streaming state
  itemCount: number;
  intervalMs: number;
  chunkingMode: 'none' | 'size' | 'count';
  chunkSize: number;
  itemsPerChunk: number;
  isStreaming: boolean;
  chunkCount: number;
  totalChunks: number;
  streamedChunks: number;
  receivedItems: number;

  // Callbacks
  onItemCountChange: (value: number) => void;
  onIntervalChange: (value: number) => void;
  onChunkingModeChange: (mode: 'none' | 'size' | 'count') => void;
  onChunkSizeChange: (value: number) => void;
  onItemsPerChunkChange: (value: number) => void;
  onStart: () => void;
  onStop: () => void;
}

export const StreamingSection: FC<StreamingSectionProps> = ({
  metrics,
  status,
  itemCount,
  intervalMs,
  chunkingMode,
  chunkSize,
  itemsPerChunk,
  isStreaming,
  chunkCount,
  totalChunks,
  streamedChunks,
  receivedItems,
  onItemCountChange,
  onIntervalChange,
  onChunkingModeChange,
  onChunkSizeChange,
  onItemsPerChunkChange,
  onStart,
  onStop,
}) => {
  return (
    <section className={styles.container}>
      <h2 className={styles.title}>🌊 Data Streaming Worker</h2>

      <div className={styles.metrics}>
        <div className={styles.metricsDisplay}>
          <div>
            <span className={styles.metricsLabel}>Messages:</span>{' '}
            {metrics.messagesReceived} in / {metrics.messagesSent} out
          </div>
          <div>
            <span className={styles.metricsLabel}>Response Time:</span>{' '}
            {metrics.averageResponseTime.toFixed(1)}ms avg
          </div>
          <div>
            <span className={styles.metricsLabel}>Throughput:</span>{' '}
            {metrics.performance.throughputPerMin?.toFixed(1) ?? 'N/A'} msg/min
          </div>
          <div>
            <span className={styles.metricsLabel}>Uptime:</span>{' '}
            {(metrics.uptime / 1000).toFixed(0)}s
          </div>
        </div>
      </div>

      <StreamingControls
        itemCount={itemCount}
        intervalMs={intervalMs}
        chunkingMode={chunkingMode}
        chunkSize={chunkSize}
        itemsPerChunk={itemsPerChunk}
        isStreaming={isStreaming}
        isWorkerRunning={status === 'running'}
        onItemCountChange={onItemCountChange}
        onIntervalChange={onIntervalChange}
        onChunkingModeChange={onChunkingModeChange}
        onChunkSizeChange={onChunkSizeChange}
        onItemsPerChunkChange={onItemsPerChunkChange}
        onStart={onStart}
        onStop={onStop}
      />

      {isStreaming && totalChunks > 0 && (
        <StreamingProgress chunkCount={chunkCount} totalChunks={totalChunks} />
      )}

      <StreamingStats
        status={status}
        chunks={streamedChunks}
        items={receivedItems}
        rate={intervalMs}
      />
    </section>
  );
};
