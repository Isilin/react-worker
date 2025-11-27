import type { WorkerMetrics as WorkerMetricsType } from './lib/types/protocol';
import styles from './WorkerMetrics.module.css';

interface Props {
  metrics: WorkerMetricsType;
}

const formatTime = (ms: number) => {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

const formatTimestamp = (ts?: number) => {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleTimeString();
};

export const WorkerMetrics = ({ metrics }: Props) => {
  // Note: CPU usage is not directly available in browsers for security reasons
  // We can only track memory usage from the worker's perspective

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>📊 Performance Metrics</h3>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Activity</h4>
        <div className={styles.grid}>
          <div className={styles.metric}>
            <span className={styles.label}>Messages Sent</span>
            <span className={styles.value}>{metrics.messagesSent}</span>
          </div>

          <div className={styles.metric}>
            <span className={styles.label}>Messages Received</span>
            <span className={styles.value}>{metrics.messagesReceived}</span>
          </div>

          <div className={styles.metric}>
            <span className={styles.label}>Uptime</span>
            <span className={styles.value}>{formatTime(metrics.uptime)}</span>
          </div>

          <div className={styles.metric}>
            <span className={styles.label}>Last Activity</span>
            <span className={styles.value}>
              {formatTimestamp(metrics.lastActivity)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Performance</h4>
        <div className={styles.grid}>
          <div className={styles.metric}>
            <span className={styles.label}>Avg Response Time</span>
            <span className={styles.value}>
              {metrics.averageResponseTime > 0
                ? `${metrics.averageResponseTime.toFixed(2)} ms`
                : 'N/A'}
            </span>
          </div>

          <div className={styles.metric}>
            <span className={styles.label}>Throughput</span>
            <span className={styles.value}>
              {typeof metrics.performance.throughputPerMin === 'number'
                ? `${metrics.performance.throughputPerMin} msg/min`
                : 'N/A'}
            </span>
          </div>

          <div className={styles.metric}>
            <span className={styles.label}>Health Status</span>
            <span
              className={`${styles.value} ${
                metrics.performance.healthStatus === 'healthy'
                  ? styles.healthy
                  : styles.degraded
              }`}
            >
              {metrics.performance.healthStatus?.toUpperCase() || 'UNKNOWN'}
            </span>
          </div>

          <div className={styles.metric}>
            <span className={styles.label}>Last Health Check</span>
            <span className={styles.value}>
              {formatTimestamp(metrics.performance.lastHealthCheck)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.info}>
        💡 Memory estimation based on worker context. Exact measurements require
        cross-origin isolation headers. Click &quot;Health Check&quot; to
        update.
      </div>
    </div>
  );
};
