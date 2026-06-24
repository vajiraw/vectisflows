/**
 * Connection pool configuration interface
 */
export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  validationIntervalMs: number;
}

/**
 * Connection pool statistics interface
 */
export interface PoolStatistics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  averageWaitTime: number;
}
