import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './App.module.css';
import { useWorker } from './lib/core/worker.hook';
import type { Inbound } from './lib/types/protocol';
import { WorkerControl } from './WorkerControl';

interface LogEntry {
  id: string;
  direction: 'in' | 'out';
  data: unknown;
  ts: number;
  worker: 'echo' | 'reverse';
}

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

const extractType = (data: unknown): string => {
  if (data && typeof data === 'object' && 'type' in data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return String((data as any).type);
  }
  return '—';
};

const App = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const bottomRefWorkerEcho = useRef<HTMLDivElement | null>(null);
  const bottomRefWorkerReverse = useRef<HTMLDivElement | null>(null);
  const bottomRefMainEcho = useRef<HTMLDivElement | null>(null);
  const bottomRefMainReverse = useRef<HTMLDivElement | null>(null);

  const echoWorker = useWorker({
    script: new URL('./echo.worker.ts', import.meta.url),
  });

  const reverseWorker = useWorker({
    script: new URL('./reverse.worker.ts', import.meta.url),
    autostart: true,
  });

  const appendOut = useCallback(
    (data: Inbound, worker: 'echo' | 'reverse') => {
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
      } else {
        reverseWorker.postMessage(data);
      }
    },
    [echoWorker, reverseWorker],
  );

  const appendIn = useCallback((data: unknown, worker: 'echo' | 'reverse') => {
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
  }, []);

  const handleStartEcho = useCallback(() => {
    echoWorker.start();
    appendOut({ type: 'PING' }, 'echo');
  }, [echoWorker, appendOut]);

  const handleTerminateEcho = useCallback(() => {
    echoWorker.terminate();
  }, [echoWorker]);

  const handleStartReverse = useCallback(() => {
    reverseWorker.start();
    appendOut({ type: 'PING' }, 'reverse');
  }, [reverseWorker, appendOut]);

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
    // Scroll each column independently to its bottom marker
    bottomRefWorkerEcho.current?.scrollIntoView({ behavior: 'smooth' });
    bottomRefWorkerReverse.current?.scrollIntoView({ behavior: 'smooth' });
    bottomRefMainEcho.current?.scrollIntoView({ behavior: 'smooth' });
    bottomRefMainReverse.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSendEcho = (message: Inbound) => {
    appendOut(message, 'echo');
  };

  const handleSendReverse = (message: Inbound) => {
    appendOut(message, 'reverse');
  };

  const handleClear = () => setLogs([]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Web Worker Control Panel - Dual Workers</h1>

      <div className={styles.columns}>
        <WorkerControl
          status={echoWorker.status}
          onStart={handleStartEcho}
          onTerminate={handleTerminateEcho}
          onSend={handleSendEcho}
        />

        <WorkerControl
          status={reverseWorker.status}
          onStart={handleStartReverse}
          onTerminate={handleTerminateReverse}
          onSend={handleSendReverse}
        />
      </div>

      <div className={styles.buttonsRow}>
        <button
          className={styles.button}
          onClick={handleClear}
          disabled={!logs.length}
        >
          Clear All Logs
        </button>
      </div>

      <div className={styles.columns}>
        <section className={styles.logSection}>
          <h2 className={styles.subtitle}>Echo Worker Messages</h2>
          <div className={styles.columns}>
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                Main Thread → Echo Worker
              </div>
              <div className={styles.logList}>
                {logs
                  .filter((l) => l.direction === 'out' && l.worker === 'echo')
                  .map((l) => (
                    <div
                      key={l.id}
                      className={styles.logItem}
                      style={{ background: '#172b4d' }}
                    >
                      <div className={styles.logMeta}>
                        <span className={styles.badge}>OUT</span>
                        <span className={styles.time}>{formatTime(l.ts)}</span>
                        <span className={styles.type}>
                          {extractType(l.data)}
                        </span>
                      </div>
                      <pre className={styles.pre}>
                        {typeof l.data === 'object'
                          ? JSON.stringify(l.data, null, 2)
                          : String(l.data)}
                      </pre>
                    </div>
                  ))}
                <div ref={bottomRefMainEcho} />
              </div>
            </div>
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                Echo Worker → Main Thread
              </div>
              <div className={styles.logList}>
                {logs
                  .filter((l) => l.direction === 'in' && l.worker === 'echo')
                  .map((l) => (
                    <div
                      key={l.id}
                      className={styles.logItem}
                      style={{ background: '#0f3d3e' }}
                    >
                      <div className={styles.logMeta}>
                        <span className={styles.badge}>IN</span>
                        <span className={styles.time}>{formatTime(l.ts)}</span>
                        <span className={styles.type}>
                          {extractType(l.data)}
                        </span>
                      </div>
                      <pre className={styles.pre}>
                        {typeof l.data === 'object'
                          ? JSON.stringify(l.data, null, 2)
                          : String(l.data)}
                      </pre>
                    </div>
                  ))}
                <div ref={bottomRefWorkerEcho} />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.logSection}>
          <h2 className={styles.subtitle}>Reverse Worker Messages</h2>
          <div className={styles.columns}>
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                Main Thread → Reverse Worker
              </div>
              <div className={styles.logList}>
                {logs
                  .filter(
                    (l) => l.direction === 'out' && l.worker === 'reverse',
                  )
                  .map((l) => (
                    <div
                      key={l.id}
                      className={styles.logItem}
                      style={{ background: '#4a1d4d' }}
                    >
                      <div className={styles.logMeta}>
                        <span className={styles.badge}>OUT</span>
                        <span className={styles.time}>{formatTime(l.ts)}</span>
                        <span className={styles.type}>
                          {extractType(l.data)}
                        </span>
                      </div>
                      <pre className={styles.pre}>
                        {typeof l.data === 'object'
                          ? JSON.stringify(l.data, null, 2)
                          : String(l.data)}
                      </pre>
                    </div>
                  ))}
                <div ref={bottomRefMainReverse} />
              </div>
            </div>
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                Reverse Worker → Main Thread
              </div>
              <div className={styles.logList}>
                {logs
                  .filter((l) => l.direction === 'in' && l.worker === 'reverse')
                  .map((l) => (
                    <div
                      key={l.id}
                      className={styles.logItem}
                      style={{ background: '#3d1f0f' }}
                    >
                      <div className={styles.logMeta}>
                        <span className={styles.badge}>IN</span>
                        <span className={styles.time}>{formatTime(l.ts)}</span>
                        <span className={styles.type}>
                          {extractType(l.data)}
                        </span>
                      </div>
                      <pre className={styles.pre}>
                        {typeof l.data === 'object'
                          ? JSON.stringify(l.data, null, 2)
                          : String(l.data)}
                      </pre>
                    </div>
                  ))}
                <div ref={bottomRefWorkerReverse} />
              </div>
            </div>
          </div>
        </section>
      </div>
      <footer className={styles.footer}>
        Echo: Try PING or {'{"hello":"world"}'} | Reverse: Try "Hello" or ["a",
        "b", "c"]
      </footer>
    </div>
  );
};

export default App;
