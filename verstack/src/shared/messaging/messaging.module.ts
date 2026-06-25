import { Global, DynamicModule, Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { AmqpConnectionProvider } from './core/connection.provider';
import { ConsumerExplorer } from './core/consumer.explorer';
import {
  DQ_MESSAGING_SERVICE_TOKEN,
  DQ_AMQP_CONNECTION_TOKEN,
} from './messaging.constants';

@Global()
@Module({})
export class MessagingModule {
  static register(): DynamicModule {
    return {
      module: MessagingModule,
      global: true,

      providers: [
        AmqpConnectionProvider,
        ConsumerExplorer,
        MessagingService,

        // optional aliases (ONLY if you need DI tokens)
        {
          provide: DQ_MESSAGING_SERVICE_TOKEN,
          useExisting: MessagingService,
        },
        {
          provide: DQ_AMQP_CONNECTION_TOKEN,
          useExisting: AmqpConnectionProvider,
        },
      ],

      exports: [
        MessagingService,
        AmqpConnectionProvider,
        ConsumerExplorer,

        // export tokens safely (still same instances)
        DQ_MESSAGING_SERVICE_TOKEN,
        DQ_AMQP_CONNECTION_TOKEN,
      ],
    };
  }
}
