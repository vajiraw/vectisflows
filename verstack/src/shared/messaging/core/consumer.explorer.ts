import { Injectable, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { AmqpConnectionProvider } from './connection.provider';
import { IMessagingService, RFQDataPayload } from '../interfaces';
import { MESSAGING_CONFIG } from '../messaging.constants';

/**
 * Consumer explorer discovers and manages message consumers across the application.
 * Handles subscription lifecycle and message routing to registered handlers.
 */
@Injectable()
export class ConsumerExplorer {
  private logger = new Logger(ConsumerExplorer.name);
  private consumers: Map<string, (msg: amqp.ConsumeMessage) => Promise<void>> = new Map();

  constructor(private readonly amqpConnection: AmqpConnectionProvider) {}

  /**
   * Register a consumer for a specific queue
   */
  async registerConsumer(
    queue: string,
    handler: (message: RFQDataPayload) => Promise<void>,
    prefetch = 1,
  ): Promise<void> {
    const channel = this.amqpConnection.getChannel();

    // Set prefetch to control how many messages are delivered at once
    await channel.prefetch(prefetch);

    const wrappedHandler = async (msg: amqp.ConsumeMessage | null) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString()) as RFQDataPayload;
          this.logger.debug(`Processing message from ${queue}:`, content.id);

          await handler(content);

          // Acknowledge the message only after successful processing
          channel.ack(msg);
          this.logger.debug(`Message acknowledged: ${content.id}`);
        } catch (error) {
          this.logger.error(
            `Error processing message from ${queue}:`,
            error instanceof Error ? error.message : error,
          );

          // Nack the message and requeue it (will go to DLQ after max retries configured in queue)
          channel.nack(msg, false, false);
          this.logger.error(`Message nacked and sent to DLQ: ${msg.properties.messageId || 'unknown'}`);
        }
      }
    };

    this.consumers.set(queue, wrappedHandler);

    await channel.consume(queue, wrappedHandler, { noAck: false });
    this.logger.log(`✓ Consumer registered for queue: ${queue}`);
  }

  /**
   * Unregister a consumer from a queue
   */
  async unregisterConsumer(queue: string): Promise<void> {
    const channel = this.amqpConnection.getChannel();
    await channel.cancel(queue);
    this.consumers.delete(queue);
    this.logger.log(`✓ Consumer unregistered from queue: ${queue}`);
  }

  /**
   * Get all registered consumers
   */
  getConsumers(): Map<string, (msg: amqp.ConsumeMessage) => Promise<void>> {
    return this.consumers;
  }
}
