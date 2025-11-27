import type { FC } from 'react';

import styles from './StreamingProgress.module.css';

export interface StreamingProgressProps {
  chunkCount: number;
  totalChunks: number;
}

export const StreamingProgress: FC<StreamingProgressProps> = ({
  chunkCount,
  totalChunks,
}) => {
  const percentage = totalChunks > 0 ? (chunkCount / totalChunks) * 100 : 0;

  return (
    <div className={styles.container}>
      <div className={styles.barBackground}>
        <div className={styles.barFill} style={{ width: `${percentage}%` }}>
          {percentage.toFixed(0)}%
        </div>
      </div>
      <div className={styles.label}>
        Chunk {chunkCount} / {totalChunks}
      </div>
    </div>
  );
};
