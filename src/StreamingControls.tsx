import type { FC } from 'react';

import styles from './StreamingControls.module.css';

export interface StreamingControlsProps {
  itemCount: number;
  intervalMs: number;
  chunkingMode: 'none' | 'size' | 'count';
  chunkSize: number;
  itemsPerChunk: number;
  isStreaming: boolean;
  isWorkerRunning: boolean;
  onItemCountChange: (value: number) => void;
  onIntervalChange: (value: number) => void;
  onChunkingModeChange: (mode: 'none' | 'size' | 'count') => void;
  onChunkSizeChange: (value: number) => void;
  onItemsPerChunkChange: (value: number) => void;
  onStart: () => void;
  onStop: () => void;
}

export const StreamingControls: FC<StreamingControlsProps> = ({
  itemCount,
  intervalMs,
  chunkingMode,
  chunkSize,
  itemsPerChunk,
  isStreaming,
  isWorkerRunning,
  onItemCountChange,
  onIntervalChange,
  onChunkingModeChange,
  onChunkSizeChange,
  onItemsPerChunkChange,
  onStart,
  onStop,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.sliders}>
        <div className={styles.sliderGroup}>
          <label className={styles.label}>Items: {itemCount}</label>
          <input
            type="range"
            min="1"
            max="1000"
            value={itemCount}
            onChange={(e) => onItemCountChange(Number(e.target.value))}
            disabled={isStreaming}
            className={styles.slider}
          />
        </div>

        <div className={styles.sliderGroup}>
          <label className={styles.label}>Interval: {intervalMs}ms</label>
          <input
            type="range"
            min="10"
            max="1000"
            step="10"
            value={intervalMs}
            onChange={(e) => onIntervalChange(Number(e.target.value))}
            disabled={isStreaming}
            className={styles.slider}
          />
        </div>
      </div>

      <div className={styles.modeSelection}>
        <label className={styles.modeLabel}>Chunking Mode:</label>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              value="none"
              checked={chunkingMode === 'none'}
              onChange={(e) =>
                onChunkingModeChange(
                  e.target.value as 'none' | 'size' | 'count',
                )
              }
              disabled={isStreaming}
              className={styles.radio}
            />
            Individual
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              value="size"
              checked={chunkingMode === 'size'}
              onChange={(e) =>
                onChunkingModeChange(
                  e.target.value as 'none' | 'size' | 'count',
                )
              }
              disabled={isStreaming}
              className={styles.radio}
            />
            By size
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              value="count"
              checked={chunkingMode === 'count'}
              onChange={(e) =>
                onChunkingModeChange(
                  e.target.value as 'none' | 'size' | 'count',
                )
              }
              disabled={isStreaming}
              className={styles.radio}
            />
            By count
          </label>
        </div>
      </div>

      {chunkingMode === 'size' && (
        <div className={styles.sliderGroup}>
          <label className={styles.label}>Chunk size: {chunkSize}B</label>
          <input
            type="range"
            min="500"
            max="10000"
            step="100"
            value={chunkSize}
            onChange={(e) => onChunkSizeChange(Number(e.target.value))}
            disabled={isStreaming}
            className={styles.slider}
          />
        </div>
      )}

      {chunkingMode === 'count' && (
        <div className={styles.sliderGroup}>
          <label className={styles.label}>
            Items per chunk: {itemsPerChunk}
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={itemsPerChunk}
            onChange={(e) => onItemsPerChunkChange(Number(e.target.value))}
            disabled={isStreaming}
            className={styles.slider}
          />
        </div>
      )}

      <div className={styles.buttons}>
        <button
          onClick={onStart}
          disabled={isStreaming || !isWorkerRunning}
          className={styles.button}
        >
          {isStreaming ? '⏳ Streaming...' : '▶️ Start Stream'}
        </button>
        <button
          onClick={onStop}
          disabled={!isStreaming}
          className={styles.button}
        >
          ⏹️ Stop
        </button>
      </div>
    </div>
  );
};
