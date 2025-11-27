/**
 * Data streaming utilities for throttled data transfer from worker to main thread
 */

export interface StreamChunk<T = unknown> {
  id: string;
  chunkIndex: number;
  totalChunks: number;
  data: T;
  timestamp: number;
}

export interface StreamOptions {
  chunkSize?: number; // Size in bytes (default: 1600)
  intervalMs?: number; // Interval between chunks in ms (default: 100)
  onChunkSent?: (chunk: StreamChunk) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Stream data in chunks with throttling
 * Useful for sending large datasets from worker to main thread without blocking
 */
export class DataStream<T = unknown> {
  private streamId: string;
  private chunks: T[];
  private currentIndex: number;
  private intervalId: ReturnType<typeof setInterval> | null;
  private options: Required<
    Omit<StreamOptions, 'onChunkSent' | 'onComplete' | 'onError'>
  > & {
    onChunkSent?: (chunk: StreamChunk<T>) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
  };

  constructor(streamId: string, options: StreamOptions = {}) {
    this.streamId = streamId;
    this.chunks = [];
    this.currentIndex = 0;
    this.intervalId = null;
    this.options = {
      chunkSize: options.chunkSize || 1600,
      intervalMs: options.intervalMs || 100,
      onChunkSent: options.onChunkSent,
      onComplete: options.onComplete,
      onError: options.onError,
    };
  }

  /**
   * Start streaming data chunks
   */
  start(data: T[]): void {
    if (this.intervalId) {
      this.stop();
    }

    this.chunks = data;
    this.currentIndex = 0;

    if (this.chunks.length === 0) {
      this.options.onComplete?.();
      return;
    }

    this.intervalId = setInterval(() => {
      try {
        if (this.currentIndex >= this.chunks.length) {
          this.stop();
          this.options.onComplete?.();
          return;
        }

        const chunk: StreamChunk<T> = {
          id: this.streamId,
          chunkIndex: this.currentIndex,
          totalChunks: this.chunks.length,
          data: this.chunks[this.currentIndex],
          timestamp: Date.now(),
        };

        this.options.onChunkSent?.(chunk);
        this.currentIndex++;
      } catch (error) {
        this.stop();
        this.options.onError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }, this.options.intervalMs);
  }

  /**
   * Stop the stream
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get stream progress
   */
  getProgress(): { current: number; total: number; percent: number } {
    return {
      current: this.currentIndex,
      total: this.chunks.length,
      percent:
        this.chunks.length > 0
          ? (this.currentIndex / this.chunks.length) * 100
          : 0,
    };
  }

  /**
   * Check if stream is active
   */
  isActive(): boolean {
    return this.intervalId !== null;
  }
}

/**
 * Helper to estimate data size in bytes (rough approximation)
 */
export function estimateDataSize(data: unknown): number {
  const str = JSON.stringify(data);
  // UTF-16 uses 2 bytes per character
  return str.length * 2;
}

/**
 * Split data into chunks based on size
 */
export function chunkDataBySize<T>(
  data: T[],
  maxChunkSize: number = 1600,
): T[][] {
  const chunks: T[][] = [];
  let currentChunk: T[] = [];
  let currentSize = 0;

  for (const item of data) {
    const itemSize = estimateDataSize(item);

    if (currentSize + itemSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(item);
    currentSize += itemSize;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Collector for reassembling streamed chunks on the main thread
 */
export class StreamCollector<T = unknown> {
  private streams: Map<string, Map<number, StreamChunk<T>>>;
  private onComplete?: (streamId: string, data: T[]) => void;

  constructor(onComplete?: (streamId: string, data: T[]) => void) {
    this.streams = new Map();
    this.onComplete = onComplete;
  }

  /**
   * Add a chunk to the collector
   */
  addChunk(chunk: StreamChunk<T>): boolean {
    if (!this.streams.has(chunk.id)) {
      this.streams.set(chunk.id, new Map());
    }

    const stream = this.streams.get(chunk.id)!;
    stream.set(chunk.chunkIndex, chunk);

    // Check if stream is complete
    if (stream.size === chunk.totalChunks) {
      const data = this.getStreamData(chunk.id);
      if (data) {
        this.onComplete?.(chunk.id, data);
        this.streams.delete(chunk.id);
        return true;
      }
    }

    return false;
  }

  /**
   * Get assembled data for a stream
   */
  getStreamData(streamId: string): T[] | null {
    const stream = this.streams.get(streamId);
    if (!stream) return null;

    const chunks = Array.from(stream.values()).sort(
      (a, b) => a.chunkIndex - b.chunkIndex,
    );

    if (chunks.length === 0) return null;

    // Verify all chunks are present
    const totalChunks = chunks[0].totalChunks;
    if (chunks.length !== totalChunks) return null;

    return chunks.map((chunk) => chunk.data);
  }

  /**
   * Get progress for a stream
   */
  getProgress(
    streamId: string,
  ): { current: number; total: number; percent: number } | null {
    const stream = this.streams.get(streamId);
    if (!stream || stream.size === 0) return null;

    const firstChunk = Array.from(stream.values())[0];
    return {
      current: stream.size,
      total: firstChunk.totalChunks,
      percent: (stream.size / firstChunk.totalChunks) * 100,
    };
  }

  /**
   * Clear a specific stream
   */
  clearStream(streamId: string): void {
    this.streams.delete(streamId);
  }

  /**
   * Clear all streams
   */
  clearAll(): void {
    this.streams.clear();
  }
}
