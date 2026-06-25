import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { IAmqpConnection } from '../interfaces/messaging.interface';
import { MESSAGING_CONFIG } from '../messaging.constants';

@Injectable()
export class AmqpConnectionProvider
  implements IAmqpConnection, OnModuleInit, OnModuleDestroy
{
  // Use `any` to avoid tight coupling with amqplib type variations across versions
  private connection: any;
  private channel: any;
  private logger = new Logger(AmqpConnectionProvider.name);
  private isConnecting = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.connection || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    try {
      const urls = MESSAGING_CONFIG.connection.urls;
      const options = MESSAGING_CONFIG.connection.connectionOptions;

      this.logger.log(`Attempting to connect to RabbitMQ: ${urls[0]}`);

      // amqplib connect expects a single URL string in many versions — use the first URL
      // Do not pass the heartbeat option directly to keep compatibility with type definitions
      this.connection = await amqp.connect(urls[0]);

      // connection model shape varies across amqplib versions; treat channel as any
      this.channel = await this.connection.createChannel();

      // Set up event handlers for automatic reconnection
      this.connection.on('error', (err) => {
        this.logger.error('Connection error:', err);
        this.handleConnectionError();
      });

      this.connection.on('close', () => {
        this.logger.warn('Connection closed, attempting to reconnect...');
        this.handleConnectionError();
      });

      // Declare exchange
      await this.channel.assertExchange(
        MESSAGING_CONFIG.exchanges.RFQ_EXCHANGE.name,
        MESSAGING_CONFIG.exchanges.RFQ_EXCHANGE.type,
        { durable: MESSAGING_CONFIG.exchanges.RFQ_EXCHANGE.durable },
      );

      // Declare main processing queue with DLX binding
      await this.channel.assertQueue(
        MESSAGING_CONFIG.queues.AI_PROCESSING.name,
        {
          durable: MESSAGING_CONFIG.queues.AI_PROCESSING.durable,
          arguments: MESSAGING_CONFIG.queues.AI_PROCESSING.arguments,
        },
      );

      // Declare DLX and DLQ
      await this.channel.assertExchange('rfq.ai.dlx', 'direct', {
        durable: true,
      });
      await this.channel.assertQueue(MESSAGING_CONFIG.queues.DLQ.name, {
        durable: MESSAGING_CONFIG.queues.DLQ.durable,
      });
      await this.channel.bindQueue(
        MESSAGING_CONFIG.queues.DLQ.name,
        'rfq.ai.dlx',
        'rfq.ai.dlq',
      );

      // Bind queue to exchange
      for (const binding of MESSAGING_CONFIG.bindings) {
        await this.channel.bindQueue(
          binding.queue,
          binding.exchange,
          binding.routingKey,
        );
      }

      this.reconnectAttempts = 0;
      this.logger.log('✓ RabbitMQ connection established successfully');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ:', error);
      this.handleConnectionError();
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection:', error);
    }
  }

  isConnected(): boolean {
    return !!this.connection && !this.connection.closed;
  }

  getConnection(): amqp.Connection {
    if (!this.connection) {
      throw new Error('AMQP connection not initialized');
    }
    return this.connection;
  }

  getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error('AMQP channel not initialized');
    }
    return this.channel;
  }

  private handleConnectionError(): void {
    this.connection = null as any;
    this.channel = null as any;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      this.logger.warn(
        `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`,
      );
      setTimeout(() => this.connect(), delay);
    } else {
      this.logger.error(
        `Failed to reconnect after ${this.maxReconnectAttempts} attempts. Manual intervention required.`,
      );
    }
  }
}
