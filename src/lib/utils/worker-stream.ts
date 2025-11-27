/**
 * Worker-side streaming utilities
 */

import {
  sendStreamChunk,
  sendStreamComplete,
  sendStreamError,
} from '../core/main';

export interface WorkerStreamOptions {
  chunkSize?: number; // Size in bytes - if provided, data will be chunked by size
  itemsPerChunk?: number; // Number of items per chunk - alternative to chunkSize
  intervalMs?: number; // Interval between chunks in ms (default: 100)
  onProgress?: (current: number, total: number) => void;
}

/**
 * Stream data from worker to main thread with throttling
 */
export class WorkerDataStream<T = unknown> {
  private workerId: string;
  private streamId: string;
  private chunks: T[] | T[][];
  private currentIndex: number;
  private intervalId: ReturnType<typeof setInterval> | null;
  private options: Required<
    Omit<WorkerStreamOptions, 'onProgress' | 'chunkSize' | 'itemsPerChunk'>
  > & {
    chunkSize?: number;
    itemsPerChunk?: number;
    onProgress?: (current: number, total: number) => void;
  };

  constructor(
    workerId: string,
    streamId: string,
    options: WorkerStreamOptions = {},
  ) {
    this.workerId = workerId;
    this.streamId = streamId;
    this.chunks = [];
    this.currentIndex = 0;
    this.intervalId = null;
    this.options = {
      intervalMs: options.intervalMs || 100,
      chunkSize: options.chunkSize,
      itemsPerChunk: options.itemsPerChunk,
      onProgress: options.onProgress,
    };
  }

  /**
   * Start streaming data chunks
   * Data will be automatically chunked if it's an array
   */
  start(data: T[] | T[][]): void {
    if (this.intervalId) {
      this.stop();
    }

    this.chunks = data;
    this.currentIndex = 0;

    if (this.chunks.length === 0) {
      sendStreamComplete(this.workerId, this.streamId);
      return;
    }

    this.intervalId = setInterval(() => {
      try {
        if (this.currentIndex >= this.chunks.length) {
          this.stop();
          sendStreamComplete(this.workerId, this.streamId);
          return;
        }

        sendStreamChunk(
          this.workerId,
          this.streamId,
          this.currentIndex,
          this.chunks.length,
          this.chunks[this.currentIndex],
        );

        this.currentIndex++;
        this.options.onProgress?.(this.currentIndex, this.chunks.length);
      } catch (error) {
        this.stop();
        sendStreamError(
          this.workerId,
          this.streamId,
          error instanceof Error ? error.message : String(error),
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
 * Helper to create and start a stream in one call
 */
export function streamData<T = unknown>(
  workerId: string,
  streamId: string,
  data: T[],
  options?: WorkerStreamOptions,
): WorkerDataStream<T> {
  const stream = new WorkerDataStream<T>(workerId, streamId, options);
  stream.start(data);
  return stream;
}

/**
 * Estimate data size in bytes (rough approximation)
 */
export function estimateSize(data: unknown): number {
  const str = JSON.stringify(data);
  // UTF-16 uses 2 bytes per character
  return str.length * 2;
}

/**
 * Chunk data array by size limit (optional)
 * If maxChunkSize is not provided, returns the data as single-item chunks
 */
export function chunkBySize<T>(data: T[], maxChunkSize?: number): T[][] {
  // If no size limit, return each item as a separate chunk
  if (!maxChunkSize) {
    return data.map((item) => [item]);
  }

  const chunks: T[][] = [];
  let currentChunk: T[] = [];
  let currentSize = 0;

  for (const item of data) {
    const itemSize = estimateSize(item);

    // If adding this item would exceed limit and we have items, start new chunk
    if (currentSize + itemSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(item);
    currentSize += itemSize;
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [[]];
}

/**
 * Chunk data array by number of items per chunk
 */
export function chunkByCount<T>(data: T[], itemsPerChunk: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < data.length; i += itemsPerChunk) {
    chunks.push(data.slice(i, i + itemsPerChunk));
  }

  return chunks.length > 0 ? chunks : [[]];
}
