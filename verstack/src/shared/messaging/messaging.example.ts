import { Injectable } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { RFQDataPayload, RFQProcessingResult } from './interfaces/event-payload.interface';

/**
 * Example service demonstrating how to use the DQMessaging module
 *
 * This is a reference implementation showing:
 * 1. Publishing RFQ payloads to the AI processing queue
 * 2. Subscribing to receive and process messages
 * 3. Handling message acknowledgment and error scenarios
 */
@Injectable()
export class MessagingExampleService {
  constructor(private readonly messaging: MessagingService) {}

  /**
   * Example: Publish a structural data payload for AI processing
   * This would typically be called when a new RFQ document is received
   */
  async publishRFQDocument(payload: RFQDataPayload): Promise<void> {
    try {
      await this.messaging.publishRFQPayload(payload);
      console.log(`✓ RFQ payload published: ${payload.id}`);
    } catch (error) {
      console.error('Failed to publish RFQ payload:', error);
      throw error;
    }
  }

  /**
   * Example: Set up a consumer for the AI processing queue
   * This would typically be called in a module's onModuleInit lifecycle hook
   */
  async setupAIProcessingConsumer(): Promise<void> {
    await this.messaging.subscribeToAIProcessing(async (message: RFQDataPayload) => {
      console.log(`Processing RFQ: ${message.id}`);
      console.log(`Source type: ${message.sourceType}`);
      console.log(`Language: ${message.sourceLanguage}`);

      // Your AI processing logic here
      // This would typically:
      // 1. Extract text via OCR (if PDF/image)
      // 2. Translate if needed (if foreign language)
      // 3. Parse via LLM to extract structured JSON
      // 4. Return results via callback URL

      const result: RFQProcessingResult = {
        payloadId: message.id,
        status: 'success',
        extractedData: {
          // Your extracted structured data
        },
        processedAt: new Date().toISOString(),
      };

      console.log(`Completed processing: ${message.id}`, result);
    });

    console.log('✓ AI Processing consumer started');
  }

  /**
   * Example: Check messaging service health
   */
  async checkHealth(): Promise<boolean> {
    return this.messaging.isHealthy();
  }
}

/**
 * EXAMPLE USAGE IN A MODULE:
 *
 * import { Module } from '@nestjs/common';
 * import { MessagingModule } from './shared/messaging/messaging.module';
 * import { MessagingExampleService } from './shared/messaging/messaging.example';
 *
 * @Module({
 *   imports: [MessagingModule.register()],
 *   providers: [MessagingExampleService],
 * })
 * export class ExampleModule implements OnModuleInit {
 *   constructor(private readonly exampleService: MessagingExampleService) {}
 *
 *   async onModuleInit() {
 *     // Start consuming messages when the module initializes
 *     await this.exampleService.setupAIProcessingConsumer();
 *   }
 * }
 *
 * EXAMPLE PUBLISHING:
 *
 * const payload: RFQDataPayload = {
 *   id: 'rfq-2024-001',
 *   sourceType: 'pdf',
 *   sourceLanguage: 'ja',
 *   payload: Buffer.from(pdfContent).toString('base64'),
 *   metadata: {
 *     originalFilename: 'proposal.pdf',
 *     uploadedBy: 'user@example.com',
 *   },
 *   createdAt: new Date().toISOString(),
 *   createdBy: 'user@example.com',
 *   callbackUrl: 'https://api.example.com/rfq/results',
 *   timeoutMs: 30000,
 * };
 *
 * await this.exampleService.publishRFQDocument(payload);
 */
