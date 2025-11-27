import { useCallback, useState } from 'react';

import styles from './App.module.css';
import { useWorker } from './lib/core/worker.hook';

interface StreamData {
  id: number;
  value: string;
  timestamp: number;
}

export const StreamingExample = () => {
  const [streamedData, setStreamedData] = useState<unknown[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [itemCount, setItemCount] = useState(100);
  const [intervalMs, setIntervalMs] = useState(100);
  const [chunkingMode, setChunkingMode] = useState<'none' | 'size' | 'count'>(
    'none',
  );
  const [chunkSize, setChunkSize] = useState(1600);
  const [itemsPerChunk, setItemsPerChunk] = useState(10);

  const dataStreamWorker = useWorker({
    script: new URL('./data-stream.worker.ts', import.meta.url),
    autostart: true,
    logLevel: 'info',
    callbacks: {
      onStreamChunk: (_streamId, chunkIndex, total) => {
        setChunkCount(chunkIndex + 1);
        setTotalChunks(total);
      },
      onStreamComplete: (_streamId, data) => {
        setStreamedData(data);
        setIsStreaming(false);
      },
      onStreamError: (_streamId, error) => {
        // eslint-disable-next-line no-console
        console.error('Stream error:', error);
        setIsStreaming(false);
      },
    },
  });

  const startStream = useCallback(() => {
    setIsStreaming(true);
    setStreamedData([]);
    setChunkCount(0);
    setTotalChunks(0);

    // Generate test data
    const data: StreamData[] = Array.from({ length: itemCount }, (_, i) => ({
      id: i,
      value: `Item ${i} - ${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now() + i,
    }));

    const payload: Record<string, unknown> = {
      action: 'stream',
      streamId: 'test-stream',
      data,
      intervalMs,
    };

    // Add chunking parameters based on mode
    if (chunkingMode === 'size') {
      payload.chunkSize = chunkSize;
    } else if (chunkingMode === 'count') {
      payload.itemsPerChunk = itemsPerChunk;
    }
    // else: no chunking parameters = individual items

    dataStreamWorker.postMessage({
      type: 'ACTION',
      payload,
    });
  }, [
    dataStreamWorker,
    itemCount,
    intervalMs,
    chunkingMode,
    chunkSize,
    itemsPerChunk,
  ]);

  const stopStream = useCallback(() => {
    dataStreamWorker.postMessage({
      type: 'ACTION',
      payload: {
        action: 'stop',
        streamId: 'test-stream',
      },
    });
    setIsStreaming(false);
  }, [dataStreamWorker]);

  // Calculate total received items
  const receivedItems = streamedData.reduce<number>((acc, chunk) => {
    if (Array.isArray(chunk)) {
      return acc + chunk.length;
    }
    return acc + 1;
  }, 0);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🌊 Data Streaming Demo</h1>

      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <div
          style={{
            background: '#1a1a2e',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Configuration</h2>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Number of items: {itemCount}
            </label>
            <input
              type="range"
              min="1"
              max="1000"
              value={itemCount}
              onChange={(e) => setItemCount(Number(e.target.value))}
              disabled={isStreaming}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Interval (ms): {intervalMs}
            </label>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              disabled={isStreaming}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '10px' }}>
              Chunking Mode:
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <label>
                <input
                  type="radio"
                  value="none"
                  checked={chunkingMode === 'none'}
                  onChange={(e) =>
                    setChunkingMode(e.target.value as 'none' | 'size' | 'count')
                  }
                  disabled={isStreaming}
                />
                {' Individual items (no chunking)'}
              </label>
              <label>
                <input
                  type="radio"
                  value="size"
                  checked={chunkingMode === 'size'}
                  onChange={(e) =>
                    setChunkingMode(e.target.value as 'none' | 'size' | 'count')
                  }
                  disabled={isStreaming}
                />
                {' By size (bytes)'}
              </label>
              <label>
                <input
                  type="radio"
                  value="count"
                  checked={chunkingMode === 'count'}
                  onChange={(e) =>
                    setChunkingMode(e.target.value as 'none' | 'size' | 'count')
                  }
                  disabled={isStreaming}
                />
                {' By count (items)'}
              </label>
            </div>
          </div>

          {chunkingMode === 'size' && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Chunk size (bytes): {chunkSize}
              </label>
              <input
                type="range"
                min="500"
                max="10000"
                step="100"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                disabled={isStreaming}
                style={{ width: '100%' }}
              />
            </div>
          )}

          {chunkingMode === 'count' && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Items per chunk: {itemsPerChunk}
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={itemsPerChunk}
                onChange={(e) => setItemsPerChunk(Number(e.target.value))}
                disabled={isStreaming}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={startStream}
              disabled={isStreaming || dataStreamWorker.status !== 'running'}
              className={styles.button}
            >
              {isStreaming ? '⏳ Streaming...' : '▶️ Start Stream'}
            </button>
            <button
              onClick={stopStream}
              disabled={!isStreaming}
              className={styles.button}
            >
              ⏹️ Stop Stream
            </button>
          </div>
        </div>

        {/* Progress */}
        {isStreaming && totalChunks > 0 && (
          <div
            style={{
              background: '#16213e',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Progress</h3>
            <div
              style={{
                background: '#0f3460',
                height: '30px',
                borderRadius: '15px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  background: 'linear-gradient(90deg, #00d4ff, #0088ff)',
                  height: '100%',
                  width: `${(chunkCount / totalChunks) * 100}%`,
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                }}
              >
                {((chunkCount / totalChunks) * 100).toFixed(0)}%
              </div>
            </div>
            <p style={{ marginTop: '10px', marginBottom: 0 }}>
              Chunk {chunkCount} / {totalChunks}
            </p>
          </div>
        )}

        {/* Results */}
        <div
          style={{
            background: '#0f3460',
            padding: '20px',
            borderRadius: '8px',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Results</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '15px',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                Worker Status
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {dataStreamWorker.status}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                Chunks Received
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {streamedData.length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                Items Received
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {receivedItems}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                Streaming Rate
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                {intervalMs}ms
              </div>
            </div>
          </div>

          {streamedData.length > 0 && (
            <details style={{ marginTop: '15px' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                View received data ({streamedData.length} chunks)
              </summary>
              <pre
                style={{
                  background: '#1a1a2e',
                  padding: '10px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '300px',
                  fontSize: '12px',
                }}
              >
                {JSON.stringify(
                  streamedData.slice(0, 5).map((chunk, i) => ({
                    chunkIndex: i,
                    data: chunk,
                  })),
                  null,
                  2,
                )}
                {streamedData.length > 5 && (
                  <div style={{ marginTop: '10px', opacity: 0.7 }}>
                    ... and {streamedData.length - 5} more chunks
                  </div>
                )}
              </pre>
            </details>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', opacity: 0.7 }}>
        <p>
          💡 This demo streams data from a worker to the main thread with
          configurable throttling.
        </p>
        <p>Adjust the settings above and click &quot;Start Stream&quot;!</p>
      </div>
    </div>
  );
};
