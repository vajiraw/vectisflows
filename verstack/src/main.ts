import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions } from '@nestjs/microservices';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from './common/logger.config';
import 'dotenv/config';

async function bootstrap() {
  const logger = WinstonModule.createLogger(loggerConfig);
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // await app.startAllMicroservices();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  logger.log(`HTTP server is listening on port ${port}`, 'Bootstrap');
  logger.log('RabbitMQ microservice is connected.', 'Bootstrap');
}

bootstrap();
