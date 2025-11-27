// Data streaming worker example
// Demonstrates how to stream large datasets from worker to main thread

import {
  onMainMessage,
  sendLog,
  sendReady,
  sendTerminated,
} from './lib/core/main';
import {
  chunkByCount,
  chunkBySize,
  estimateSize,
  WorkerDataStream,
} from './lib/utils/worker-stream';

const WORKER_ID = 'data-stream';

sendReady(WORKER_ID);
sendLog(WORKER_ID, 'info', 'Data streaming worker initialized');

// Store active streams
const activeStreams = new Map<string, WorkerDataStream>();

onMainMessage({
  onAction: (payload) => {
    const { action, data, streamId, chunkSize, itemsPerChunk, intervalMs } =
      payload as {
        action: 'stream' | 'stop';
        data?: unknown[];
        streamId?: string;
        chunkSize?: number;
        itemsPerChunk?: number;
        intervalMs?: number;
      };

    switch (action) {
      case 'stream': {
        if (!data || !streamId) {
          sendLog(WORKER_ID, 'error', 'Missing data or streamId for streaming');
          return;
        }

        // Stop any existing stream with this ID
        if (activeStreams.has(streamId)) {
          activeStreams.get(streamId)?.stop();
          activeStreams.delete(streamId);
        }

        sendLog(
          WORKER_ID,
          'info',
          `Starting stream ${streamId} with ${data.length} items`,
        );

        // Chunk the data by size or count, or send as individual items
        let chunks: unknown[][];
        if (chunkSize) {
          chunks = chunkBySize(data, chunkSize);
          sendLog(
            WORKER_ID,
            'debug',
            `Data chunked by size (${chunkSize}B) into ${chunks.length} chunks`,
          );
        } else if (itemsPerChunk) {
          chunks = chunkByCount(data, itemsPerChunk);
          sendLog(
            WORKER_ID,
            'debug',
            `Data chunked by count (${itemsPerChunk} items) into ${chunks.length} chunks`,
          );
        } else {
          // No chunking - send each item individually, but enforce ~1.6KB packets
          const TARGET_PACKET_SIZE = 1600; // bytes

          const toPaddedPacket = (item: unknown): Record<string, unknown> => {
            let base: Record<string, unknown>;
            if (item && typeof item === 'object' && !Array.isArray(item)) {
              base = { ...(item as Record<string, unknown>) };
            } else {
              base = { __value: item };
            }

            const sizeWithoutPad = estimateSize(base);
            if (sizeWithoutPad >= TARGET_PACKET_SIZE) return base;

            // Account for overhead of adding the __pad field
            const overhead =
              estimateSize({ ...base, __pad: '' }) - sizeWithoutPad;
            let remaining = TARGET_PACKET_SIZE - sizeWithoutPad - overhead;
            if (remaining < 0) remaining = 0;

            let padChars = Math.ceil(remaining / 2); // 2 bytes per char (UTF-16)
            base.__pad = 'x'.repeat(Math.max(0, padChars));

            // Fine-tune to hit or slightly exceed the target
            let current = estimateSize(base);
            if (current < TARGET_PACKET_SIZE) {
              const extra = Math.ceil((TARGET_PACKET_SIZE - current) / 2);
              base.__pad += 'x'.repeat(extra);
            } else if (current > TARGET_PACKET_SIZE) {
              const trim = Math.ceil((current - TARGET_PACKET_SIZE) / 2);
              base.__pad = (base.__pad as string).slice(
                0,
                Math.max(0, (base.__pad as string).length - trim),
              );
            }

            return base;
          };

          const padded = (data as unknown[]).map(toPaddedPacket);
          chunks = chunkByCount(padded, 1);
          sendLog(
            WORKER_ID,
            'debug',
            `Streaming ${chunks.length} items individually (fixed ~1.6KB packets)`,
          );
        }

        // Create and start stream
        const stream = new WorkerDataStream(WORKER_ID, streamId, {
          intervalMs: intervalMs || 100,
          onProgress: (current, total) => {
            sendLog(
              WORKER_ID,
              'debug',
              `Streaming progress: ${current}/${total} (${((current / total) * 100).toFixed(1)}%)`,
            );
          },
        });

        activeStreams.set(streamId, stream);
        stream.start(chunks);

        // Clean up when done
        setTimeout(
          () => {
            if (!stream.isActive()) {
              activeStreams.delete(streamId);
              sendLog(WORKER_ID, 'info', `Stream ${streamId} completed`);
            }
          },
          (intervalMs || 100) * chunks.length + 500,
        );
        break;
      }

      case 'stop': {
        if (!streamId) {
          sendLog(WORKER_ID, 'error', 'Missing streamId for stop action');
          return;
        }

        const stream = activeStreams.get(streamId);
        if (stream) {
          stream.stop();
          activeStreams.delete(streamId);
          sendLog(WORKER_ID, 'info', `Stream ${streamId} stopped`);
        } else {
          sendLog(WORKER_ID, 'warn', `Stream ${streamId} not found`);
        }
        break;
      }

      default:
        sendLog(WORKER_ID, 'warn', `Unknown action: ${action}`);
    }
  },

  onTerminate: () => {
    sendLog(WORKER_ID, 'info', 'Terminating data streaming worker');
    // Stop all active streams
    activeStreams.forEach((stream) => stream.stop());
    activeStreams.clear();
    sendTerminated(WORKER_ID);
    self.close();
  },
});
