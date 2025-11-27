import type { FC } from 'react';

import type { Inbound, Outbound } from './lib/types/protocol';
import { LogEntries } from './LogEntries';
import { LogEntry as LogEntryComponent } from './LogEntry';
import styles from './WorkerLogsSection.module.css';

interface LogEntry {
  id: string;
  direction: 'in' | 'out';
  data: unknown;
  ts: number;
}

export interface WorkerLogsSectionProps {
  title: string;
  workerName: string;
  logs: LogEntry[];
  outboundBackground?: string;
  inboundBackground?: string;
}

export const WorkerLogsSection: FC<WorkerLogsSectionProps> = ({
  title,
  workerName,
  logs,
  outboundBackground = '#172b4d',
  inboundBackground = '#0f3d3e',
}) => {
  const outboundLogs = logs.filter((l) => l.direction === 'out');
  const inboundLogs = logs.filter((l) => l.direction === 'in');

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.logColumns}>
        <LogEntries title={`Main Thread → ${workerName}`}>
          {outboundLogs.map((l) => (
            <LogEntryComponent
              direction={l.direction}
              data={l.data as Outbound}
              timestamp={l.ts}
              background={outboundBackground}
              key={l.id}
            />
          ))}
        </LogEntries>
        <LogEntries title={`${workerName} → Main Thread`}>
          {inboundLogs.map((l) => (
            <LogEntryComponent
              direction={l.direction}
              data={l.data as Inbound}
              timestamp={l.ts}
              background={inboundBackground}
              key={l.id}
            />
          ))}
        </LogEntries>
      </div>
    </section>
  );
};
