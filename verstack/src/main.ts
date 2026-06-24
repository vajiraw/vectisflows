import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions } from '@nestjs/microservices';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './common/logger.config';
import { MessagingModule } from './shared/messaging';
import 'dotenv/config';


async function bootstrap() {
  // Create Winston logger instance
  const logger = WinstonModule.createLogger(loggerConfig);

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(loggerConfig),
  });

  app.useLogger(logger);

  // app.connectMicroservice<MicroserviceOptions>(getRabbitMQConfig());
  // logger.log('Starting NestJS application with RabbitMQ microservice...'+getRabbitMQConfig());

  await app.startAllMicroservices();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  logger.log(`HTTP server is listening on port ${port}`, 'Bootstrap');
  logger.log('RabbitMQ microservice is connected.', 'Bootstrap');
}

bootstrap();
