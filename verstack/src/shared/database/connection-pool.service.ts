import { Injectable, Logger , Optional} from '@nestjs/common';
import { ConnectionPoolConfig, PoolStatistics } from './interfaces';
import {
  DEFAULT_CONNECTION_POOL_CONFIG,
} from './constants';

/**
 * Connection Pool Service
 * Manages and optimizes database connection pooling
 */
@Injectable()
export class ConnectionPoolService {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private config: ConnectionPoolConfig;
  private activeConnections = 0;
  private idleConnections = 0;
  private totalRequests = 0;
  private totalWaitTime = 0;
  private createdAt = new Date();

  constructor(
    @Optional() config?: Partial<ConnectionPoolConfig>,
  ) {
    this.config = {
      ...DEFAULT_CONNECTION_POOL_CONFIG,
      ...config,
    };

    this.logger.log(
      `Connection pool initialized with config: ${JSON.stringify(this.config)}`,
    );
  }

  /**
   * Acquire a connection from the pool
   */
  async acquireConnection(): Promise<void> {
    const startTime = Date.now();

    if (
      this.activeConnections + this.idleConnections <
      this.config.maxConnections
    ) {
      this.activeConnections++;
      this.totalRequests++;
      const waitTime = Date.now() - startTime;
      this.totalWaitTime += waitTime;
      this.logger.debug(
        `Connection acquired. Active: ${this.activeConnections}, Idle: ${this.idleConnections}`,
      );
    } else if (this.idleConnections > 0) {
      this.idleConnections--;
      this.activeConnections++;
      this.totalRequests++;
      const waitTime = Date.now() - startTime;
      this.totalWaitTime += waitTime;
      this.logger.debug(
        `Reused idle connection. Active: ${this.activeConnections}, Idle: ${this.idleConnections}`,
      );
    } else {
      this.logger.warn('Connection pool exhausted, waiting...');
      // In production, implement exponential backoff and queue management
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.connectionTimeoutMs),
      );
      return this.acquireConnection();
    }
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(): void {
    if (this.activeConnections > 0) {
      this.activeConnections--;
      this.idleConnections++;
      this.logger.debug(
        `Connection released. Active: ${this.activeConnections}, Idle: ${this.idleConnections}`,
      );
    }
  }

  /**
   * Get current pool statistics
   */
  getStatistics(): PoolStatistics {
    const averageWaitTime =
      this.totalRequests > 0 ? this.totalWaitTime / this.totalRequests : 0;

    return {
      totalConnections: this.activeConnections + this.idleConnections,
      activeConnections: this.activeConnections,
      idleConnections: this.idleConnections,
      waitingRequests: 0, // Would track queued requests in production
      averageWaitTime: Math.round(averageWaitTime),
    };
  }

  /**
   * Validate pool health
   */
  async validatePoolHealth(): Promise<boolean> {
    try {
      if (
        this.activeConnections < this.config.minConnections &&
        this.idleConnections + this.activeConnections < this.config.minConnections
      ) {
        this.logger.warn(
          `Pool below minimum connections. Min: ${this.config.minConnections}, Current: ${this.activeConnections + this.idleConnections}`,
        );
        // Ensure minimum connections
        while (
          this.activeConnections + this.idleConnections <
          this.config.minConnections
        ) {
          this.idleConnections++;
        }
        return false;
      }

      if (
        this.activeConnections + this.idleConnections >
        this.config.maxConnections
      ) {
        this.logger.warn(
          `Pool above maximum connections. Max: ${this.config.maxConnections}, Current: ${this.activeConnections + this.idleConnections}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Pool health validation failed', error);
      return false;
    }
  }

  /**
   * Reset pool statistics
   */
  resetStatistics(): void {
    this.totalRequests = 0;
    this.totalWaitTime = 0;
    this.logger.log('Pool statistics reset');
  }

  /**
   * Drain all connections
   */
  async drain(): Promise<void> {
    this.logger.log('Draining connection pool...');
    while (this.activeConnections > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.idleConnections = 0;
    this.logger.log('Connection pool drained');
  }

  /**
   * Get pool uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.createdAt.getTime();
  }
}
