import { DynamicModule, Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { AmqpConnectionProvider } from './core/connection.provider';
import { ConsumerExplorer } from './core/consumer.explorer';
import {
  DQ_MESSAGING_SERVICE_TOKEN,
  DQ_AMQP_CONNECTION_TOKEN,
} from './messaging.constants';

/**
 * DQMessaging Dynamic Module
 *
 * Provides RabbitMQ connectivity and message publishing/subscription capabilities
 * for the DQ AI processing system.
 *
 * Usage in your module:
 * ```typescript
 * @Module({
 *   imports: [MessagingModule.register()],
 * })
 * export class YourModule {}
 * ```
 *
 * Then inject in your service:
 * ```typescript
 * constructor(private readonly messaging: MessagingService) {}
 * ```
 */
@Module({})
export class MessagingModule {
  /**
   * Register the messaging module dynamically
   * This pattern allows the module to be configured and imported globally
   */
  static register(): DynamicModule {
    return {
      module: MessagingModule,
      providers: [
        AmqpConnectionProvider,
        ConsumerExplorer,
        MessagingService,
        {
          provide: DQ_MESSAGING_SERVICE_TOKEN,
          useClass: MessagingService,
        },
        {
          provide: DQ_AMQP_CONNECTION_TOKEN,
          useClass: AmqpConnectionProvider,
        },
      ],
      exports: [MessagingService, AmqpConnectionProvider, ConsumerExplorer],
    };
  }
}
