/**
 * Get detailed memory usage for this WorkerGlobalScope when supported.
 * Filters the breakdown to entries attributed to this worker (DedicatedWorkerGlobalScope).
 * Returns the sum of bytes for matching entries, or undefined if unsupported.
 */
export async function getWorkerMemoryDetailed(): Promise<number | undefined> {
  const perf = performance as unknown as {
    measureUserAgentSpecificMemory?: () => Promise<{
      bytes: number;
      breakdown: Array<{
        bytes: number;
        attribution?: Array<{
          url?: string;
          container?: { src?: string };
        }>;
        types?: string[];
      }>;
    }>;
  };

  if (!perf.measureUserAgentSpecificMemory) return undefined;

  try {
    const m = await perf.measureUserAgentSpecificMemory();
    if (!m?.breakdown) return m?.bytes ?? undefined;

    // Try to isolate entries that refer to this worker's global scope
    const workerEntries = m.breakdown.filter((b) => {
      const types = b.types || [];
      // Chromium labels usually include 'DedicatedWorkerGlobalScope' for worker contexts
      const isWorkerType =
        types.includes('DedicatedWorkerGlobalScope') ||
        types.includes('Worker');

      // Attribution may include the worker script URL; best-effort check
      const hasWorkerUrl = (b.attribution || []).some((a) => {
        const url = a.url || a.container?.src;
        return !!url && url.includes('.worker');
      });

      return isWorkerType || hasWorkerUrl;
    });

    if (workerEntries.length === 0) {
      // Fallback to total bytes if we can't isolate
      return m.bytes;
    }

    const sum = workerEntries.reduce((acc, e) => acc + (e.bytes || 0), 0);
    return sum || m.bytes;
  } catch {
    return undefined;
  }
}

/**
 * Report whether the worker can measure memory with UA-specific API
 */
export function getWorkerMemorySupport(): {
  crossOriginIsolated: boolean;
  hasUserAgentAPI: boolean;
} {
  const globalAny = globalThis as unknown as {
    crossOriginIsolated?: boolean;
  };
  const coi = globalAny.crossOriginIsolated === true;
  const hasUA = 'measureUserAgentSpecificMemory' in performance;
  return { crossOriginIsolated: coi, hasUserAgentAPI: hasUA };
}
