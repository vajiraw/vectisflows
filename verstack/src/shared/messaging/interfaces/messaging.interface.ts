/**
 * Interface for AMQP connection management
 */
export interface IAmqpConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnection(): any;
  getChannel(): any;
}

/**
 * Interface for messaging service
 */
export interface IMessagingService {
  /**
   * Publish a message to the RabbitMQ exchange
   */
  publishMessage(
    message: Record<string, unknown>,
    routingKey: string,
    options?: Record<string, unknown>,
  ): Promise<boolean>;

  /**
   * Subscribe to a queue with a handler
   */
  subscribe(queue: string, handler: (msg: any) => Promise<void>): Promise<void>;

  /**
   * Unsubscribe from a queue
   */
  unsubscribe(queue: string): Promise<void>;

  /**
   * Check connection status
   */
  isHealthy(): Promise<boolean>;
}
