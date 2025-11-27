import { useCallback, useEffect, useState } from 'react';

import styles from './App.module.css';
import { useWorker } from './lib/core/worker.hook';
import type { Inbound, Outbound } from './lib/types/protocol';
import { LogEntries } from './LogEntries';
import { LogEntry } from './LogEntry';
import { StreamingSection } from './StreamingSection';
import { WorkerControl } from './WorkerControl';
import { WorkerMetrics } from './WorkerMetrics';

interface LogEntry {
  id: string;
  direction: 'in' | 'out';
  data: unknown;
  ts: number;
  worker: 'echo' | 'reverse' | 'stream';
}

interface StreamData {
  id: number;
  value: string;
  timestamp: number;
}

const App = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Streaming state
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

  const echoWorker = useWorker({
    script: new URL('./echo.worker.ts', import.meta.url),
    logLevel: 'debug',
    timeout: 5000,
    keepAlive: true, // Keep worker alive indefinitely
  });

  const reverseWorker = useWorker({
    script: new URL('./reverse.worker.ts', import.meta.url),
    autostart: true,
    logLevel: 'debug',
    timeout: 5000,
    keepAlive: false, // Auto-terminate after inactivity
    idleTimeout: 30000, // 30 seconds of inactivity
  });

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

  const appendOut = useCallback(
    (data: Inbound, worker: 'echo' | 'reverse' | 'stream') => {
      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          direction: 'out',
          data,
          ts: Date.now(),
          worker,
        },
      ]);
      if (worker === 'echo') {
        echoWorker.postMessage(data);
      } else if (worker === 'reverse') {
        reverseWorker.postMessage(data);
      } else {
        dataStreamWorker.postMessage(data);
      }
    },
    [echoWorker, reverseWorker, dataStreamWorker],
  );

  const appendIn = useCallback(
    (data: unknown, worker: 'echo' | 'reverse' | 'stream') => {
      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          direction: 'in',
          data,
          ts: Date.now(),
          worker,
        },
      ]);
    },
    [],
  );

  const handleStartEcho = useCallback(() => {
    echoWorker.start();
  }, [echoWorker]);

  const handleTerminateEcho = useCallback(() => {
    echoWorker.terminate();
  }, [echoWorker]);

  const handleStartReverse = useCallback(() => {
    reverseWorker.start();
  }, [reverseWorker]);

  const handleTerminateReverse = useCallback(() => {
    reverseWorker.terminate();
  }, [reverseWorker]);

  useEffect(() => {
    const cleanupEcho = echoWorker.onMessage((e) => appendIn(e.data, 'echo'));
    return cleanupEcho;
  }, [echoWorker, appendIn]);

  useEffect(() => {
    const cleanupReverse = reverseWorker.onMessage((e) =>
      appendIn(e.data, 'reverse'),
    );
    return cleanupReverse;
  }, [reverseWorker, appendIn]);

  useEffect(() => {
    const cleanupStream = dataStreamWorker.onMessage((e) =>
      appendIn(e.data, 'stream'),
    );
    return cleanupStream;
  }, [dataStreamWorker, appendIn]);

  const handleSendEcho = useCallback(
    (message: Inbound) => {
      appendOut(message, 'echo');
    },
    [appendOut],
  );

  const handleSendReverse = useCallback(
    (message: Inbound) => {
      appendOut(message, 'reverse');
    },
    [appendOut],
  );

  const handleClear = () => setLogs([]);

  const startStream = useCallback(() => {
    setIsStreaming(true);
    setStreamedData([]);
    setChunkCount(0);
    setTotalChunks(0);

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

    if (chunkingMode === 'size') {
      payload.chunkSize = chunkSize;
    } else if (chunkingMode === 'count') {
      payload.itemsPerChunk = itemsPerChunk;
    }

    appendOut(
      {
        type: 'ACTION',
        payload,
      },
      'stream',
    );
  }, [
    itemCount,
    intervalMs,
    chunkingMode,
    chunkSize,
    itemsPerChunk,
    appendOut,
  ]);

  const stopStream = useCallback(() => {
    appendOut(
      {
        type: 'ACTION',
        payload: {
          action: 'stop',
          streamId: 'test-stream',
        },
      },
      'stream',
    );
    setIsStreaming(false);
  }, [appendOut]);

  const receivedItems = streamedData.reduce<number>((acc, chunk) => {
    if (Array.isArray(chunk)) {
      return acc + chunk.length;
    }
    return acc + 1;
  }, 0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      handleSendEcho({ type: 'HEALTH_CHECK' });
      handleSendReverse({ type: 'HEALTH_CHECK' });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [handleSendEcho, handleSendReverse]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        Web Worker Control Panel - Dual Workers + Streaming
      </h1>

      <div className={styles.columns}>
        <div>
          <WorkerControl
            status={echoWorker.status}
            onStart={handleStartEcho}
            onTerminate={handleTerminateEcho}
            onSend={handleSendEcho}
          />
          <WorkerMetrics metrics={echoWorker.metrics} />
        </div>

        <div>
          <WorkerControl
            status={reverseWorker.status}
            onStart={handleStartReverse}
            onTerminate={handleTerminateReverse}
            onSend={handleSendReverse}
          />
          <WorkerMetrics metrics={reverseWorker.metrics} />
        </div>
      </div>

      {/* Data Streaming Section */}
      <StreamingSection
        metrics={dataStreamWorker.metrics}
        status={dataStreamWorker.status}
        itemCount={itemCount}
        intervalMs={intervalMs}
        chunkingMode={chunkingMode}
        chunkSize={chunkSize}
        itemsPerChunk={itemsPerChunk}
        isStreaming={isStreaming}
        chunkCount={chunkCount}
        totalChunks={totalChunks}
        streamedChunks={streamedData.length}
        receivedItems={receivedItems}
        onItemCountChange={setItemCount}
        onIntervalChange={setIntervalMs}
        onChunkingModeChange={setChunkingMode}
        onChunkSizeChange={setChunkSize}
        onItemsPerChunkChange={setItemsPerChunk}
        onStart={startStream}
        onStop={stopStream}
      />

      <div className={styles.buttonsRow}>
        <button
          className={styles.button}
          onClick={handleClear}
          disabled={!logs.length}
        >
          Clear All Logs
        </button>
      </div>

      <div className={styles.logsContainer}>
        {/* Main Thread Column */}
        <section className={styles.logSection}>
          <h2 className={styles.logTitle}>Main Thread</h2>
          <div className={styles.logColumn}>
            <LogEntries title="Outgoing Messages">
              {logs
                .filter((l) => l.direction === 'out')
                .map((l) => (
                  <LogEntry
                    direction={l.direction}
                    data={l.data as Outbound}
                    timestamp={l.ts}
                    background={
                      l.worker === 'echo'
                        ? '#172b4d'
                        : l.worker === 'reverse'
                          ? '#4a1d4d'
                          : '#1d3a4a'
                    }
                    key={l.id}
                  />
                ))}
            </LogEntries>
          </div>
        </section>

        {/* Echo Worker Column */}
        <section className={styles.logSection}>
          <h2 className={styles.logTitle}>Echo Worker</h2>
          <div className={styles.logColumn}>
            <LogEntries title="Incoming Messages">
              {logs
                .filter((l) => l.direction === 'in' && l.worker === 'echo')
                .map((l) => (
                  <LogEntry
                    direction={l.direction}
                    data={l.data as Inbound}
                    timestamp={l.ts}
                    background="#0f3d3e"
                    key={l.id}
                  />
                ))}
            </LogEntries>
          </div>
        </section>

        {/* Reverse Worker Column */}
        <section className={styles.logSection}>
          <h2 className={styles.logTitle}>Reverse Worker</h2>
          <div className={styles.logColumn}>
            <LogEntries title="Incoming Messages">
              {logs
                .filter((l) => l.direction === 'in' && l.worker === 'reverse')
                .map((l) => (
                  <LogEntry
                    direction={l.direction}
                    data={l.data as Inbound}
                    timestamp={l.ts}
                    background="#3d1f0f"
                    key={l.id}
                  />
                ))}
            </LogEntries>
          </div>
        </section>

        {/* Streaming Worker Column */}
        <section className={styles.logSection}>
          <h2 className={styles.logTitle}>Streaming Worker</h2>
          <div className={styles.logColumn}>
            <LogEntries title="Incoming Messages">
              {logs
                .filter((l) => l.direction === 'in' && l.worker === 'stream')
                .map((l) => (
                  <LogEntry
                    direction={l.direction}
                    data={l.data as Inbound}
                    timestamp={l.ts}
                    background="#0f2d3d"
                    key={l.id}
                  />
                ))}
            </LogEntries>
          </div>
        </section>
      </div>
      <footer className={styles.footer}>
        Test messages: PING (📡), Health Check (🏥), Graceful Stop (🛑) | Echo:
        {'  '}
        {'{"type":"ECHO","payload":"test"}'} | Reverse:{' '}
        {'{"type":"ACTION","payload":"Hello"}'} | Stream: Use controls above
      </footer>
    </div>
  );
};

export default App;
