import { Module, DynamicModule, Provider, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DatabaseService } from './database.service';
import { ConnectionPoolService } from './connection-pool.service';
import {
  DATABASE_MODULE_OPTIONS,
  PRISMA_SERVICE,
  CONNECTION_POOL_SERVICE,
} from './constants';
import { DatabaseOptions } from './interfaces';

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(options?: DatabaseOptions): DynamicModule {
    const moduleConfig: DatabaseOptions = {
      isGlobal: options?.isGlobal ?? true,
      config: options?.config,
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
        useFactory: (options: DatabaseOptions) =>
          new ConnectionPoolService(options?.config),
        inject: [DATABASE_MODULE_OPTIONS],
      },
      {
        provide: DatabaseService,
        useFactory: (prisma: PrismaService, pool: ConnectionPoolService) =>
          new DatabaseService(prisma, pool),
        inject: [PRISMA_SERVICE, CONNECTION_POOL_SERVICE],
      },
    ];

    return {
      module: DatabaseModule,
      global: moduleConfig.isGlobal,
      providers,
      exports: [DatabaseService, DATABASE_MODULE_OPTIONS],
    };
  }

  static forRootAsync(asyncOptions: any): DynamicModule {
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
          useFactory: (options: DatabaseOptions) =>
            new ConnectionPoolService(options?.config),
          inject: [DATABASE_MODULE_OPTIONS],
        },
        {
          provide: DatabaseService,
          useFactory: (prisma: PrismaService, pool: ConnectionPoolService) =>
            new DatabaseService(prisma, pool),
          inject: [PRISMA_SERVICE, CONNECTION_POOL_SERVICE],
        },
      ],
      exports: [DatabaseService, DATABASE_MODULE_OPTIONS],
    };
  }
}
