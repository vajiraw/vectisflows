import { Injectable, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { AmqpConnectionProvider } from './core/connection.provider';
import { ConsumerExplorer } from './core/consumer.explorer';
import { IMessagingService, RFQDataPayload } from './interfaces';
import { MESSAGING_CONFIG } from './messaging.constants';

/**
 * Main messaging service providing a public API for publishing and subscribing to RabbitMQ messages.
 * Handles message serialization, error handling, and health checks.
 */
@Injectable()
export class MessagingService implements IMessagingService {
  private logger = new Logger(MessagingService.name);

  constructor(
    private readonly amqpConnection: AmqpConnectionProvider,
    private readonly consumerExplorer: ConsumerExplorer,
  ) {}

  /**
   * Publish a message to the RabbitMQ exchange
   * @param message The message payload to publish
   * @param routingKey The routing key for the message
   * @param options Additional publishing options
   * @returns boolean indicating success
   */
  async publishMessage(
    message: Record<string, unknown>,
    routingKey: string,
    options?: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      if (!this.amqpConnection.isConnected()) {
        this.logger.warn('AMQP connection not ready, attempting reconnection...');
        await this.amqpConnection.connect();
      }

      const channel = this.amqpConnection.getChannel();
      const exchange = MESSAGING_CONFIG.exchanges.RFQ_EXCHANGE.name;

      const publishOptions: amqp.Options.Publish = {
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        persistent: true,
        messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        ...options,
      };

      const buffer = Buffer.from(JSON.stringify(message));
      const published = channel.publish(exchange, routingKey, buffer, publishOptions);

      if (published) {
        this.logger.log(
          `✓ Message published to ${exchange} with routing key: ${routingKey}`,
        );
      } else {
        this.logger.warn(`Channel buffer full, message may not be delivered immediately`);
      }

      return published;
    } catch (error) {
      this.logger.error(
        `Error publishing message:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Publish a structural data payload to the AI processing queue
   * @param payload The RFQ data payload
   * @param options Additional publishing options
   */
  async publishRFQPayload(
    payload: RFQDataPayload,
    options?: Record<string, unknown>,
  ): Promise<boolean> {
    return this.publishMessage(
      (payload as unknown) as Record<string, unknown>,
      MESSAGING_CONFIG.routingKeys.STATUS_UPLOADED,
      options,
    );
  }

  /**
   * Subscribe to messages in a queue
   * @param queue The queue name to subscribe to
   * @param handler Async function to handle each message
   */
  async subscribe(queue: string, handler: (msg: RFQDataPayload) => Promise<void>): Promise<void> {
    try {
      if (!this.amqpConnection.isConnected()) {
        await this.amqpConnection.connect();
      }

      await this.consumerExplorer.registerConsumer(queue, handler);
    } catch (error) {
      this.logger.error(
        `Error subscribing to queue ${queue}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Subscribe to the default AI processing queue
   */
  async subscribeToAIProcessing(
    handler: (msg: RFQDataPayload) => Promise<void>,
  ): Promise<void> {
    await this.subscribe(MESSAGING_CONFIG.queues.AI_PROCESSING.name, handler);
  }

  /**
   * Unsubscribe from a queue
   * @param queue The queue name to unsubscribe from
   */
  async unsubscribe(queue: string): Promise<void> {
    try {
      await this.consumerExplorer.unregisterConsumer(queue);
    } catch (error) {
      this.logger.error(
        `Error unsubscribing from queue ${queue}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Check the health of the messaging service
   * @returns boolean indicating if the service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const connected = this.amqpConnection.isConnected();
      if (!connected) {
        this.logger.warn('Not connected to RabbitMQ');
        return false;
      }

      // Test the channel
      const channel = this.amqpConnection.getChannel();
      if (!channel) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Health check failed:`,
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  }

  /**
   * Get all registered consumers
   */
  getRegisteredConsumers(): Map<string, any> {
    return this.consumerExplorer.getConsumers();
  }
}
