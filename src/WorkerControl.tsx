import { useState } from 'react';

import type { Inbound, WorkerStatus } from './lib/types/protocol';
import styles from './WorkerControl.module.css';

interface Props {
  status: WorkerStatus;
  onStart: () => void;
  onTerminate: () => void;
  onSend: (message: Inbound) => void;
}

export const WorkerControl = ({
  status,
  onStart,
  onTerminate,
  onSend,
}: Props) => {
  const [pendingMessage, setPendingMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingMessage(e.target.value);
  };

  const handleSend = () => {
    if (pendingMessage.trim() !== '') {
      let parsed: Inbound = JSON.parse(pendingMessage.trim());
      onSend(parsed);
      setPendingMessage('');
    }
  };

  const handlePing = () => {
    onSend({ type: 'PING' });
  };

  const handleHealthCheck = () => {
    onSend({ type: 'HEALTH_CHECK' });
  };

  const handleGracefulTerminate = () => {
    onSend({ type: 'TERMINATE' });
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.workerTitle}>Worker Control</h2>
      <div className={styles.statusRow}>
        <span className={styles.statusLabel}>Status:</span>
        <span className={`${styles.statusValue} ${styles[status]}`}>
          {status.toUpperCase()}
        </span>
      </div>
      <div className={styles.buttonsRow}>
        <button
          className={styles.button}
          onClick={onStart}
          disabled={status === 'running'}
        >
          Start
        </button>
        <button
          className={styles.button}
          onClick={onTerminate}
          disabled={status !== 'running'}
        >
          Force Kill
        </button>
      </div>
      <div className={styles.buttonsRow}>
        <button
          className={styles.button}
          onClick={handlePing}
          disabled={status !== 'running'}
        >
          📡 PING
        </button>
        <button
          className={styles.button}
          onClick={handleHealthCheck}
          disabled={status !== 'running'}
        >
          🏥 Health Check
        </button>
        <button
          className={styles.button}
          onClick={handleGracefulTerminate}
          disabled={status !== 'running'}
        >
          🛑 Graceful Stop
        </button>
      </div>
      <div className={styles.sendRow}>
        <input
          className={styles.input}
          placeholder={'Message (text ou JSON)'}
          value={pendingMessage}
          onChange={handleChange}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className={styles.button}
          onClick={handleSend}
          disabled={status !== 'running'}
        >
          Send
        </button>
      </div>
    </section>
  );
};
