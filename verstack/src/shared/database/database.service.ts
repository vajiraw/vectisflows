import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ConnectionPoolService } from './connection-pool.service';


/**
 * Database Service
 * Provides base database operations and utilities
 * Acts as a facade for common database operations
 */
@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionPool: ConnectionPoolService,
  ) {
    this.logger.log('DatabaseService initialized');
  }

  /**
   * Get Prisma client instance
   */
  getPrismaClient(): PrismaService {
    return this.prisma;
  }

  /**
   * Get connection pool service instance
   */
  getConnectionPool(): ConnectionPoolService {
    return this.connectionPool;
  }

  /**
   * Check database connection health
   */
  async isConnected(): Promise<boolean> {
    try {
      const health = await this.prisma.getHealthStatus();
      this.logger.debug(`Database health check: ${health ? 'OK' : 'FAILED'}`);
      return health;
    } catch (error) {
      this.logger.error('Database connection health check failed', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    try {
      const stats = await this.prisma.getDatabaseStats();
      const poolStats = this.connectionPool.getStatistics();
      return {
        database: stats,
        connectionPool: poolStats,
        uptime: this.connectionPool.getUptime(),
      };
    } catch (error) {
      this.logger.error('Failed to retrieve database statistics', error);
      return null;
    }
  }

  /**
   * Execute a transaction
   */
  // async transaction<T>(callback: (tx: any) => Promise<T>,
  // ): Promise<T> {
  //   try {
  //     this.logger.debug('Starting database transaction');
  //     await this.connectionPool.acquireConnection();

  //     const result = await this.prisma.$transaction(async (tx) => {
  //       return callback(tx);
  //     });

  //     this.connectionPool.releaseConnection();
  //     this.logger.debug('Transaction completed successfully');
  //     return result;
  //   } catch (error) {
  //     this.connectionPool.releaseConnection();
  //     this.logger.error('Transaction failed', error);
  //     throw error;
  //   }
  // }

  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
  this.logger.debug('Starting database transaction');

  try {
    // Explicitly pass the generic type T to Prisma's $transaction method
    const result = await this.prisma.$transaction<T>(async (tx) => {
      return await callback(tx);
    });

    this.logger.debug('Transaction completed successfully');
    return result;
  } catch (error) {
    this.logger.error('Transaction failed', error);
    throw error;
  }
}



  /**
   * Execute a raw SQL query
   */
  async executeRawQuery<T = any>(
    sql: string,
    parameters: any[] = [],
  ): Promise<T> {
    try {
      this.logger.debug(`Executing raw query: ${sql}`);
      await this.connectionPool.acquireConnection();

      const result = await this.prisma.executeRawQuery<T>(sql, parameters);

      this.connectionPool.releaseConnection();
      return result;
    } catch (error) {
      this.connectionPool.releaseConnection();
      this.logger.error(`Failed to execute raw query: ${sql}`, error);
      throw error;
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStatistics() {
    return this.connectionPool.getStatistics();
  }

  /**
   * Validate connection pool health
   */
  async validatePoolHealth(): Promise<boolean> {
    try {
      return await this.connectionPool.validatePoolHealth();
    } catch (error) {
      this.logger.error('Pool health validation failed', error);
      return false;
    }
  }

  /**
   * Get database version
   */
  async getDatabaseVersion(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<
        Array<{ version: string }>
      >`SELECT version() as version`;
      return result[0]?.version || 'Unknown';
    } catch (error) {
      this.logger.error('Failed to get database version', error);
      return 'Unknown';
    }
  }

  /**
   * Test database connection with timeout
   */
  async testConnection(timeoutMs: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.warn(`Database connection test timed out after ${timeoutMs}ms`);
        resolve(false);
      }, timeoutMs);

      this.isConnected()
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve(false);
        });
    });
  }
}
