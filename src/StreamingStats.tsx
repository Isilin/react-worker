import type { FC } from 'react';

import styles from './StreamingStats.module.css';

export interface StreamingStatsProps {
  status: string;
  chunks: number;
  items: number;
  rate: number;
}

export const StreamingStats: FC<StreamingStatsProps> = ({
  status,
  chunks,
  items,
  rate,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.stat}>
        <div className={styles.label}>Status</div>
        <div className={styles.value}>{status}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.label}>Chunks</div>
        <div className={styles.value}>{chunks}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.label}>Items</div>
        <div className={styles.value}>{items}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.label}>Rate</div>
        <div className={styles.value}>{rate}ms</div>
      </div>
    </div>
  );
};
