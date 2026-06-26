import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
// Fixed: Imported cleanly as an interface/contract rather than a strict inline 'type' modifier
import { type RFQDataPayload } from '../shared/messaging/interfaces/event-payload.interface';
import { RfqsParsingService } from './rfqs-parsing.service';
import { DatabaseService } from '../shared/database/database.service';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { MESSAGING_CONFIG } from '../shared/messaging/messaging.constants';
import 'dotenv/config'; 

const ROUTING_KEY = 'rfq.status.uploaded';

@Controller()
export class RfqsConsumer {
  private readonly logger = new Logger(RfqsConsumer.name);

  constructor(
    private readonly rfqsParsingService: RfqsParsingService,
    private readonly databaseService: DatabaseService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Consumes messages explicitly from 'queue.ai.processing' bound to 'rfq.exchange'
   */
  @EventPattern(ROUTING_KEY, {
    transport: 5, // Transport.RMQ
    options: {
      queue: 'queue.ai.processing',
      queueOptions: {
        durable: true,
        // ✅ FIXED CLICHE: Added the explicit DLX arguments matching your messaging.constants.ts
        arguments: {
          'x-dead-letter-exchange': 'rfq.ai.dlx',
          'x-dead-letter-routing-key': 'rfq.ai.dlq',
        },
      },
    },
  })
  async handleRfqParsingJob(@Payload() data: RFQDataPayload, @Ctx() context: RmqContext): Promise<void> {
    const channel = context.getChannelRef();
    const originalMessage = context.getMessage();
    
    // Safety check if data structural wrap gets misread
    const trackingId = data?.id;

    if (!trackingId) {
      this.logger.error('Received an structural message format missing a valid ID tracking reference.');
      channel.nack(originalMessage, false, false);
      return;
    }

    this.logger.log(`Received job from queue.ai.processing. Tracking ID: ${trackingId}`);

    try {
      // 1. Transition status to PROCESSING
      await this.rfqsParsingService.updateRfqLedgerStatus(trackingId, 'PROCESSING');

      // 2. Call External AI Service
      this.logger.log(`Forwarding to AI parser for Tracking ID: ${trackingId}`);
      const aiResponse = await this.callExternalAiService(data.payload);

      // 3. Persist the final parsed output
      await this.saveParsedRfqData(trackingId, aiResponse, data);

      // 4. Update ledger status to COMPLETED
      await this.rfqsParsingService.updateRfqLedgerStatus(trackingId, 'COMPLETED');

      // 5. Acknowledge message completion to RabbitMQ
      channel.ack(originalMessage);
      this.logger.log(`Successfully acknowledged RFQ parsing job for ID: ${trackingId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing queue message for ID: ${trackingId}`, error);

      // Mark ledger as FAILED
      await this.rfqsParsingService.updateRfqLedgerStatus(trackingId, 'FAILED', errorMessage).catch((dbErr) => {
        this.logger.error(`Failed to record terminal failure state for tracking ID: ${trackingId}`, dbErr);
      });

      // Reject message without requeueing to send straight to dead-letter queue
      channel.nack(originalMessage, false, false); 
    }
  }

//   private async callExternalAiService(payload: any): Promise<any> {
//    // const aiApiUrl = 'https://api.external-ai-service.com/v1/parse'; 
//     const aiApiUrl = 'http://172.25.28.123:11434/api/generate'; // Local mock AI service for testing
//     const apiKey = process.env.EXTERNAL_AI_API_KEY;

//     const response$ = this.httpService.post(
//       aiApiUrl,
//       { data: payload },
//       { headers: {  'Content-Type': 'application/json' } }
//     );

//     const result = await firstValueFrom(response$);
//     return result.data;
//   }


private async callExternalAiService(payload: any): Promise<any> {
  // 1. Set your target Ollama / local AI URL
  const aiApiUrl = process.env.AI_API_URL as string ; 

  // 2. Define your system extraction blueprint instructions
  const systemInstruction = 
    `System: Extract into JSON with keys: product_name, quantity, destination, timeline_weeks, sample_required, target_price_usd, special_instructions.`;

  // 3. Construct the clean prompt combining the schema definition and raw input payload
  const fullPrompt = `${systemInstruction}\n\nUser: ${payload}`;

  // 4. Assemble the exact JSON body payload requested by the local model engine
  const requestBody = {
    model: 'granite4.1:3b',
    prompt: fullPrompt,
    stream: false,
    format: 'json',
  };

  this.logger.debug(`Sending structured prompt to local AI: ${JSON.stringify(requestBody)}`);

  try {
    // 5. Fire off the HTTP request
    const response$ = this.httpService.post(
      aiApiUrl,
      requestBody, // Replaced '{ data: payload }' with the precise format mapping
      { headers: { 'Content-Type': 'application/json' } }
    );

    const result = await firstValueFrom(response$);
    
    // 6. Handle internal parsing if the local server returns the JSON object wrapped or as a raw text block
    let finalOutput = result.data;
    
    // Ollama typically returns a top level structural object like { response: "{\n  \"product_name\": ...}" }
    if (result.data && typeof result.data.response === 'string') {
      try {
        finalOutput = JSON.parse(result.data.response);
      } catch (e) {
        this.logger.warn('Failed to parse inner string response from local AI engine into native JSON object.', e);
        finalOutput = result.data.response;
      }
    }

    return finalOutput;
  } catch (apiError) {
    this.logger.error(`Local AI Invocations failed on endpoint ${aiApiUrl}`, apiError);
    throw apiError;
  }
}

  private async saveParsedRfqData(trackingId: string, aiResponse: any, originalData: RFQDataPayload): Promise<void> {
  const prisma = this.databaseService.getPrismaClient();

  const commodityType = aiResponse.product_name || 'Unknown Commodity';
  const rawQuantity = parseInt(aiResponse.quantity, 10);
  const quantity = isNaN(rawQuantity) ? 0 : rawQuantity;
  const technicalSpecs = aiResponse.special_instructions || null;
  
  const timelineWeeks = parseInt(aiResponse.timeline_weeks, 10) || 4; 
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (timelineWeeks * 7));

  // 1. Build a clean, native string array for your text[] column
  const requiredCertificates: string[] = [];
  
  if (aiResponse.sample_required === true || String(aiResponse.sample_required).toLowerCase() === 'true') {
    requiredCertificates.push('PRE_ORDER_SAMPLE_REQUIRED');
  }
  if (aiResponse.target_price_usd) {
    requiredCertificates.push(`TARGET_PRICE_${aiResponse.target_price_usd}_USD`);
  }

  this.logger.log(`Executing database transaction to insert into rfqs table...`);
    const technicalSpecsJson = technicalSpecs ? JSON.stringify({ notes: technicalSpecs }) : null;
  // todo 1. Insert into rfqs table (buyer_id needs to fix null here)
  await prisma.$transaction([  
  prisma.$executeRaw`
    INSERT INTO rfqs (
      id, 
      buyer_id, 
      commodity_type, 
      quantity, 
      unit, 
      technical_specs, 
      required_certificates, 
      expires_at, 
      status
    ) VALUES (
      ${crypto.randomUUID()},                         
      ${null},  
      ${commodityType},                               
      ${quantity},                                    
      'units',                                     
      ${technicalSpecsJson},                              
      ${requiredCertificates},                        
      ${expiresAt},                                   
      'PENDING_REVIEW'                             
    )
  `,

  // 2. Update operational ledger (Prisma maps the object to valid JSON automatically)
  prisma.$executeRaw`
    UPDATE operational_ledger 
    SET payload = payload || ${JSON.stringify({ aiParsedOutput: aiResponse })}::jsonb, 
        updated_at = NOW()
    WHERE correlation_id = ${trackingId}
  `
]);
}
}