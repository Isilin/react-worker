import { useEffect, useRef, type PropsWithChildren } from 'react';

import styles from './LogEntries.module.css';

interface Props {
  title: string;
}

export const LogEntries = ({ title, children }: PropsWithChildren<Props>) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll each column independently to its bottom marker
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [children]);

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>{title}</div>
      <div className={styles.logList}>
        {children}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
