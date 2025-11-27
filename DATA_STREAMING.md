# Data Streaming

The library provides utilities for streaming large datasets from workers to the main thread with throttling control.

## Features

- **Throttled transfer**: Control data rate (e.g., 1.6KB every 100ms)
- **Automatic chunking**: Split large datasets into manageable chunks
- **Progress tracking**: Monitor streaming progress
- **Automatic reassembly**: Collect chunks on main thread
- **Error handling**: Robust error recovery

## Worker Side Usage

### Basic Streaming

```typescript
import { WorkerDataStream, chunkBySize } from './lib/utils/worker-stream';

const WORKER_ID = 'my-worker';

// Prepare large dataset
const largeDataset = generateData(); // Array of objects

// Chunk by size (1.6KB per chunk)
const chunks = chunkBySize(largeDataset, 1600);

// Create and start stream
const stream = new WorkerDataStream(WORKER_ID, 'stream-1', {
  chunkSize: 1600, // bytes per chunk
  intervalMs: 100, // ms between chunks
  onProgress: (current, total) => {
    console.log(`Progress: ${current}/${total}`);
  },
});

stream.start(chunks);
```

### Helper Function

```typescript
import { streamData } from './lib/utils/worker-stream';

// One-liner to stream data
const stream = streamData('my-worker', 'stream-1', data, {
  chunkSize: 1600,
  intervalMs: 100,
});
```

### Complete Worker Example

```typescript
// data-stream.worker.ts
import {
  onMainMessage,
  sendReady,
  sendLog,
  sendTerminated,
} from './lib/core/main';
import { chunkBySize, WorkerDataStream } from './lib/utils/worker-stream';

const WORKER_ID = 'data-stream';
sendReady(WORKER_ID);

const activeStreams = new Map<string, WorkerDataStream>();

onMainMessage({
  onAction: (payload) => {
    const { action, data, streamId, chunkSize, intervalMs } = payload as {
      action: 'stream' | 'stop';
      data?: unknown[];
      streamId?: string;
      chunkSize?: number;
      intervalMs?: number;
    };

    if (action === 'stream' && data && streamId) {
      // Chunk data by size
      const chunks = chunkBySize(data, chunkSize || 1600);

      // Create and start stream
      const stream = new WorkerDataStream(WORKER_ID, streamId, {
        chunkSize: chunkSize || 1600,
        intervalMs: intervalMs || 100,
      });

      activeStreams.set(streamId, stream);
      stream.start(chunks);
    }
  },

  onTerminate: () => {
    // Clean up all streams
    activeStreams.forEach((stream) => stream.stop());
    sendTerminated(WORKER_ID);
    self.close();
  },
});
```

## Main Thread Usage

### Basic Setup

```typescript
import { useWorker } from './lib';

function MyComponent() {
  const [streamedData, setStreamedData] = useState<unknown[]>([]);

  const worker = useWorker({
    script: new URL('./data-stream.worker.ts', import.meta.url),
    autostart: true,
    callbacks: {
      onStreamChunk: (streamId, chunkIndex, totalChunks, data) => {
        console.log(`Received chunk ${chunkIndex + 1}/${totalChunks}`);
        // Data is accumulated automatically
      },
      onStreamComplete: (streamId, data) => {
        console.log(`Stream ${streamId} complete with ${data.length} items`);
        setStreamedData(data);
      },
      onStreamError: (streamId, error) => {
        console.error(`Stream ${streamId} error:`, error);
      },
    },
  });

  const startStream = () => {
    // Generate large dataset
    const data = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      value: Math.random(),
      text: `Item ${i}`,
    }));

    worker.postMessage({
      type: 'ACTION',
      payload: {
        action: 'stream',
        streamId: 'my-stream',
        data,
        chunkSize: 1600,  // 1.6KB per chunk
        intervalMs: 100,   // Send every 100ms
      },
    });
  };

  return (
    <div>
      <button onClick={startStream}>Start Stream</button>
      <p>Received {streamedData.length} items</p>
    </div>
  );
}
```

### Manual Collector Usage

For advanced use cases, you can manually manage chunk collection:

```typescript
import { StreamCollector } from './lib';

const collector = new StreamCollector<MyDataType>((streamId, data) => {
  console.log(`Stream ${streamId} completed with ${data.length} items`);
});

// In your message handler
worker.onMessage((event) => {
  const data = event.data;

  if (data.type === 'STREAM_CHUNK') {
    const isComplete = collector.addChunk({
      id: data.streamId,
      chunkIndex: data.chunkIndex,
      totalChunks: data.totalChunks,
      data: data.data,
      timestamp: Date.now(),
    });

    if (isComplete) {
      console.log('Stream completed!');
    }
  }
});

// Check progress
const progress = collector.getProgress('my-stream');
console.log(`${progress.percent}% complete`);
```

## API Reference

### Worker Side

#### `WorkerDataStream<T>`

```typescript
class WorkerDataStream<T = unknown> {
  constructor(
    workerId: string,
    streamId: string,
    options?: WorkerStreamOptions,
  );

  start(data: T[] | T[][]): void;
  stop(): void;
  getProgress(): { current: number; total: number; percent: number };
  isActive(): boolean;
}
```

#### `WorkerStreamOptions`

```typescript
interface WorkerStreamOptions {
  chunkSize?: number; // Default: 1600 bytes
  intervalMs?: number; // Default: 100ms
  onProgress?: (current: number, total: number) => void;
}
```

#### Helper Functions

```typescript
// Stream data in one call
function streamData<T>(
  workerId: string,
  streamId: string,
  data: T[],
  options?: WorkerStreamOptions,
): WorkerDataStream<T>;

// Chunk data by size
function chunkBySize<T>(data: T[], maxChunkSize?: number): T[][];

// Estimate data size in bytes
function estimateSize(data: unknown): number;
```

### Main Thread

#### `StreamCollector<T>`

```typescript
class StreamCollector<T = unknown> {
  constructor(onComplete?: (streamId: string, data: T[]) => void);

  addChunk(chunk: StreamChunk<T>): boolean;
  getStreamData(streamId: string): T[] | null;
  getProgress(
    streamId: string,
  ): { current: number; total: number; percent: number } | null;
  clearStream(streamId: string): void;
  clearAll(): void;
}
```

#### `WorkerCallbacks` (streaming additions)

```typescript
interface WorkerCallbacks {
  onStreamChunk?: (
    streamId: string,
    chunkIndex: number,
    totalChunks: number,
    data: unknown,
  ) => void;
  onStreamComplete?: (streamId: string, data: unknown[]) => void;
  onStreamError?: (streamId: string, error: string) => void;
}
```

## Performance Considerations

### Chunk Size

- **Small chunks (512B - 1KB)**: More overhead, smoother UI
- **Medium chunks (1.6KB - 4KB)**: Good balance (recommended)
- **Large chunks (8KB+)**: Less overhead, may block UI

### Interval

- **Fast (50-100ms)**: Quick transfer, consistent rate
- **Medium (100-200ms)**: Balanced, good for most cases
- **Slow (500ms+)**: Very throttled, minimal impact

### Example Scenarios

```typescript
// Scenario 1: Real-time data feed (fast, small chunks)
streamData(workerId, 'feed', data, {
  chunkSize: 512,
  intervalMs: 50,
});

// Scenario 2: Large dataset transfer (balanced)
streamData(workerId, 'dataset', data, {
  chunkSize: 1600,
  intervalMs: 100,
});

// Scenario 3: Background export (slow, large chunks)
streamData(workerId, 'export', data, {
  chunkSize: 8192,
  intervalMs: 500,
});
```

## Best Practices

1. **Choose appropriate chunk size**: Balance between transfer overhead and UI responsiveness
2. **Clean up streams**: Always stop streams when component unmounts
3. **Handle errors**: Implement `onStreamError` callback
4. **Monitor progress**: Use `onProgress` for user feedback
5. **Test with real data**: Estimate chunk sizes based on actual data structure

## Example: CSV Export

```typescript
// Worker side
const csvData = generateLargeCSV(); // Returns array of CSV rows
const chunks = chunkBySize(csvData, 1600);

streamData('csv-worker', 'export-1', chunks, {
  intervalMs: 100,
  onProgress: (current, total) => {
    const percent = (current / total) * 100;
    sendProgress('csv-worker', percent, 'Exporting CSV...');
  },
});

// Main thread
const worker = useWorker({
  script: new URL('./csv-export.worker.ts', import.meta.url),
  callbacks: {
    onStreamComplete: (streamId, chunks) => {
      const csvText = chunks.flat().join('\n');
      downloadFile('export.csv', csvText);
    },
    onProgress: (percent) => {
      setExportProgress(percent);
    },
  },
});
```
