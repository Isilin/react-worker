import type { Inbound, Outbound } from './lib/types/protocol';
import styles from './LogEntry.module.css';

interface Props {
  direction: 'in' | 'out';
  data: Inbound | Outbound;
  timestamp: number;
  background: string;
}

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

export const LogEntry = ({ direction, data, timestamp, background }: Props) => {
  return (
    <div className={styles.logItem} style={{ background }}>
      <div className={styles.logMeta}>
        <span className={styles.badge}>{direction.toUpperCase()}</span>
        <span className={styles.time}>{formatTime(timestamp)}</span>
        <span className={styles.type}>{data.type}</span>
      </div>
      <pre className={styles.pre}>
        {typeof data === 'object'
          ? JSON.stringify(data, null, 2)
          : String(data)}
      </pre>
    </div>
  );
};
