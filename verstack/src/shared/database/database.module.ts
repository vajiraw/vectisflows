import {
  Module,
  DynamicModule,
  Provider,
  Global,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DatabaseService } from './database.service';
import { ConnectionPoolService } from './connection-pool.service';
import {
  DATABASE_MODULE_OPTIONS,
  PRISMA_SERVICE,
  CONNECTION_POOL_SERVICE,
} from './constants';
import { DatabaseOptions, DatabaseConfig } from './interfaces';

/**
 * Database Module
 * Provides Prisma ORM integration with NestJS
 * Supports dynamic module registration with forRoot pattern
 */
@Global()
@Module({})
export class DatabaseModule {
  /**
   * Register database module synchronously
   */
  static forRoot(options?: DatabaseOptions): DynamicModule {
    const isGlobal = options?.isGlobal ?? true;
    const config = options?.config;

    const moduleConfig: DatabaseOptions = {
      isGlobal,
      config,
    };

    const providers: Provider[] = [
      {
        provide: DATABASE_MODULE_OPTIONS,
        useValue: moduleConfig,
      },
      {
        provide: PRISMA_SERVICE,
        useClass: PrismaService,
      },
      {
        provide: CONNECTION_POOL_SERVICE,
        useFactory: (options: DatabaseOptions) => {
          return new ConnectionPoolService(options?.config);
        },
        inject: [DATABASE_MODULE_OPTIONS],
      },
      {
        provide: DatabaseService,
        useFactory: (
          prisma: PrismaService,
          pool: ConnectionPoolService,
        ) => {
          return new DatabaseService(prisma, pool);
        },
        inject: [PRISMA_SERVICE, CONNECTION_POOL_SERVICE],
      },
      PrismaService,
      ConnectionPoolService,
      DatabaseService,
    ];

    return {
      module: DatabaseModule,
      global: isGlobal,
      providers,
      exports: [
        DatabaseService,
        PrismaService,
        ConnectionPoolService,
        DATABASE_MODULE_OPTIONS,
      ],
    };
  }

  /**
   * Register database module asynchronously
   */
  static forRootAsync(
    asyncOptions?: any,
  ): DynamicModule {
    return {
      module: DatabaseModule,
      global: asyncOptions?.isGlobal ?? true,
      imports: asyncOptions?.imports || [],
      providers: [
        {
          provide: DATABASE_MODULE_OPTIONS,
          useFactory: asyncOptions?.useFactory,
          inject: asyncOptions?.inject || [],
        },
        {
          provide: PRISMA_SERVICE,
          useClass: PrismaService,
        },
        {
          provide: CONNECTION_POOL_SERVICE,
          useFactory: (options: DatabaseOptions) => {
            return new ConnectionPoolService(options?.config);
          },
          inject: [DATABASE_MODULE_OPTIONS],
        },
        {
          provide: DatabaseService,
          useFactory: (
            prisma: PrismaService,
            pool: ConnectionPoolService,
          ) => {
            return new DatabaseService(prisma, pool);
          },
          inject: [PRISMA_SERVICE, CONNECTION_POOL_SERVICE],
        },
        PrismaService,
        ConnectionPoolService,
        DatabaseService,
      ],
      exports: [
        DatabaseService,
        PrismaService,
        ConnectionPoolService,
        DATABASE_MODULE_OPTIONS,
      ],
    };
  }
}
