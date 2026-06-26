import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import { WinstonModule } from 'nest-winston'; // Assuming this matches your import
import { loggerConfig } from './common/logger.config'; // Adjust path accordingly
import { MESSAGING_CONFIG } from './shared/messaging/messaging.constants'; // Adjust path accordingly

async function bootstrap() {
  const logger = WinstonModule.createLogger(loggerConfig);
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // 1. Connect RabbitMQ Microservice using your immutable MESSAGING_CONFIG values
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: MESSAGING_CONFIG.connection.urls,
      queue: MESSAGING_CONFIG.queues.AI_PROCESSING.name,
      noAck: false, // CRITICAL: Allows manual channel.ack() in your consumer
      queueOptions: {
        durable: MESSAGING_CONFIG.queues.AI_PROCESSING.durable,
        arguments: MESSAGING_CONFIG.queues.AI_PROCESSING.arguments,
      },
    },
  });

  // 2. Start the Microservice Listeners
  await app.startAllMicroservices();
  logger.log('RabbitMQ microservice listeners activated.', 'Bootstrap');

  // 3. Listen on the HTTP Port
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  
  logger.log(`HTTP server is listening on port ${port}`, 'Bootstrap');
}

bootstrap();