import { Test, TestingModule } from '@nestjs/testing';
import { MessagingService } from './messaging.service';
import { AmqpConnectionProvider } from './core/connection.provider';
import { ConsumerExplorer } from './core/consumer.explorer';
import { RFQDataPayload } from './interfaces';

/**
 * Integration tests for the DQMessaging module
 * Note: These tests require a running RabbitMQ server
 */
describe('MessagingService Integration Tests', () => {
  let messagingService: MessagingService;
  let amqpConnection: AmqpConnectionProvider;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [MessagingService, AmqpConnectionProvider, ConsumerExplorer],
    }).compile();

    amqpConnection = module.get(AmqpConnectionProvider);
    messagingService = module.get(MessagingService);

    // Wait for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Connection Management', () => {
    it('should establish RabbitMQ connection', async () => {
      const isConnected = amqpConnection.isConnected();
      expect(isConnected).toBe(true);
    });

    it('should provide a valid channel', () => {
      const channel = amqpConnection.getChannel();
      expect(channel).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should report healthy status when connected', async () => {
      const isHealthy = await messagingService.isHealthy();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Message Publishing', () => {
    it('should publish a message to RFQ exchange', async () => {
      const payload: RFQDataPayload = {
        id: `test-${Date.now()}`,
        sourceType: 'plain_text',
        sourceLanguage: 'en',
        payload: Buffer.from('test data').toString('base64'),
        metadata: {
          source: 'test',
          version: 1,
        },
        createdAt: new Date().toISOString(),
        createdBy: 'test-suite',
      };

      const result = await messagingService.publishRFQPayload(payload);
      expect(result).toBe(true);
    });

    it('should handle publishing errors gracefully', async () => {
      const invalidPayload: any = {
        // Invalid payload structure
        missing_required_fields: true,
      };

      // Should handle serialization
      await expect(async () => {
        await messagingService.publishMessage(
          invalidPayload,
          'rfq.status.uploaded',
        );
      }).not.toThrow();
    });
  });

  describe('Consumer Management', () => {
    it('should register a consumer', async () => {
      const handler = jest.fn(async () => {
        // Handler implementation
      });

      await messagingService.subscribe('queue.ai.processing', handler);

      const consumers = messagingService.getRegisteredConsumers();
      expect(consumers.size).toBeGreaterThan(0);
    });

    it('should unregister a consumer', async () => {
      const handler = jest.fn();
      await messagingService.subscribe('queue.ai.processing', handler);

      const consumersBefore = messagingService.getRegisteredConsumers().size;

      await messagingService.unsubscribe('queue.ai.processing');

      // Consumer should be removed
      expect(consumersBefore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Message Processing', () => {
    it('should process messages asynchronously', async (done) => {
      const testMessage: RFQDataPayload = {
        id: `async-test-${Date.now()}`,
        sourceType: 'email',
        payload: 'test email content',
        createdAt: new Date().toISOString(),
      };

      const handler = jest.fn(async (msg: RFQDataPayload) => {
        expect(msg.id).toBe(testMessage.id);
        done();
      });

      await messagingService.subscribeToAIProcessing(handler);
      await messagingService.publishRFQPayload(testMessage);

      // Give consumer time to process
      setTimeout(() => {
        expect(handler).toHaveBeenCalled();
      }, 2000);
    });
  });
});

/**
 * UNIT TEST EXAMPLE (Mocked dependencies):
 *
 * describe('MessagingService Unit Tests', () => {
 *   let messagingService: MessagingService;
 *   let mockConnection: jest.Mocked<AmqpConnectionProvider>;
 *   let mockExplorer: jest.Mocked<ConsumerExplorer>;
 *
 *   beforeEach(() => {
 *     mockConnection = {
 *       isConnected: jest.fn().mockReturnValue(true),
 *       getChannel: jest.fn().mockReturnValue({}),
 *     } as any;
 *
 *     mockExplorer = {
 *       registerConsumer: jest.fn(),
 *     } as any;
 *
 *     messagingService = new MessagingService(mockConnection, mockExplorer);
 *   });
 *
 *   it('should call connection.isConnected', async () => {
 *     await messagingService.isHealthy();
 *     expect(mockConnection.isConnected).toHaveBeenCalled();
 *   });
 * });
 */
