import log from 'loglevel';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Inbound, Outbound, WorkerStatus } from '../types/protocol';

interface Props {
  script: string | URL; // Allow passing a URL via import.meta.url for bundlers like Vite
  options?: WorkerOptions;
  autostart?: boolean;
}

interface WorkerHook {
  start: () => void;
  postMessage: (message: Inbound) => void; // Main to Worker message
  onMessage: (
    handler: (event: MessageEvent<Outbound>) => void, // Worker to Main message
  ) => () => void;
  terminate: () => void;
  status: WorkerStatus;
}

if (!window.Worker) {
  throw new Error('Web Workers are not supported in this environment.');
}

export const useWorker = ({
  script,
  options,
  autostart = false,
}: Props): WorkerHook => {
  const worker = useRef<Worker | null>(null);
  const listenersRef = useRef<Set<(event: MessageEvent) => void>>(new Set());
  const [status, setStatus] = useState<
    'idle' | 'starting' | 'running' | 'terminating'
  >('idle');

  const terminate = useCallback(() => {
    setStatus('terminating');
    worker.current?.terminate();
    worker.current = null;
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    if (worker.current) {
      terminate();
    }

    try {
      setStatus('starting');
      worker.current = new Worker(script, { type: 'module', ...options });
      onMessage((event: MessageEvent) => {
        const data = event.data as Outbound;
        if (data.type === 'READY') {
          setStatus('running');
        }
      });
      // Attach any pre-registered listeners to the new worker instance
      listenersRef.current.forEach((handler) => {
        worker.current?.addEventListener('message', handler);
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'SecurityError') {
        log.error(
          'SecurityError: Failed to create worker due to security restrictions',
          error,
        );
      } else if (
        error instanceof DOMException &&
        error.name === 'NetworkError'
      ) {
        log.error('NetworkError: Failed to load worker script', error);
      } else if (error instanceof SyntaxError) {
        log.error('SyntaxError: Invalid worker script', error);
      } else {
        log.error('Failed to create worker', error);
      }
    }
  }, [terminate, script, options]);

  // Send message to Worker
  const postMessage = (message: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    worker.current?.postMessage(message as any);
  };

  // On message from Worker
  const onMessage = (handler: (event: MessageEvent) => void) => {
    listenersRef.current.add(handler);
    if (worker.current) {
      worker.current.addEventListener('message', handler);
    }
    return () => {
      listenersRef.current.delete(handler);
      worker.current?.removeEventListener('message', handler);
    };
  };

  useEffect(() => {
    if (autostart) {
      start();
    }
    return () => {
      terminate();
    };
  }, [autostart, start, terminate]);

  return {
    start,
    postMessage,
    onMessage,
    terminate,
    status,
  };
};
