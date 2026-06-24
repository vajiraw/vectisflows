import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma Service
 * Manages Prisma Client lifecycle and provides database connectivity
 */
@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, Prisma.LogLevel | Prisma.LogDefinition>
  implements OnModuleInit, OnModuleDestroy
{
  // $transaction(arg0: (tx: any) => Promise<T>) {
  //   throw new Error('Method not implemented.');
  // }
  private readonly logger = new Logger(PrismaService.name);
  $queryRaw: any;

  constructor() {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL as string,
    });

    // Uses Prisma's adapter-pg to wire PrismaClient to a pg.Pool.
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    this.setupEventHandlers();
  }

  /**
   * Initialize Prisma on module init
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Disconnect on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('✅ Database disconnected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to disconnect from database', error);
    }
  }

  /**
   * Setup event handlers for Prisma client
   */
  private setupEventHandlers(): void {
    this.$on('query', (e: any) => {
      this.logger.debug(`Query: ${e.query}`);
      this.logger.debug(`Duration: ${e.duration}ms`);
    });

    this.$on('error', (e: any) => {
      this.logger.error(`Database Error: ${e.message}`);
    });

    this.$on('warn', (e: any) => {
      this.logger.warn(`Database Warning: ${e.message}`);
    });
  }

  /**
   * Execute raw SQL query
   */
  async executeRawQuery<T = any>(
    sql: string,
    parameters: any[] = [],
  ): Promise<T> {
    try {
      const result = await this.$queryRawUnsafe<T>(sql, ...parameters);
      return result;
    } catch (error) {
      this.logger.error(`Failed to execute raw query: ${sql}`, error);
      throw error;
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const stats = await this.$queryRaw`
        SELECT 
          datname,
          numbackends as active_connections,
          pg_database_size(datname) as size_bytes
        FROM pg_stat_database
        WHERE datname = current_database()
      `;
      return stats;
    } catch (error) {
      this.logger.error('Failed to get database stats', error);
      return null;
    }
  }
}
