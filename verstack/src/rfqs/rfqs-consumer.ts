import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { type RFQDataPayload } from '../shared/messaging/interfaces/event-payload.interface';
import { RfqsParsingService } from './rfqs-parsing.service';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { DatabaseService } from '../shared/database/database.service';
import { MessagingService } from '../shared/messaging/messaging.service';
import * as crypto from 'crypto';
import 'dotenv/config';

const ROUTING_KEY = 'rfq.status.uploaded';

@Controller()
export class RfqsConsumer {
  private readonly logger = new Logger(RfqsConsumer.name);

  constructor(
    private readonly rfqsParsingService: RfqsParsingService,
    private readonly databaseService: DatabaseService,
    private readonly httpService: HttpService,
    private readonly messagingService: MessagingService,
  ) {}

  @EventPattern(ROUTING_KEY, {
    transport: 5,
    options: {
      queue: 'queue.ai.processing',
      queueOptions: {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'rfq.ai.dlx',
          'x-dead-letter-routing-key': 'rfq.ai.dlq',
        },
      },
    },
  })
  async handleRfqParsingJob(
    @Payload() data: RFQDataPayload,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef();
    const originalMessage = context.getMessage();
    const trackingId = data?.id;

    if (!trackingId) {
      this.logger.error('Received RFQ parsing job without a valid correlation id (data.id)');
      channel.nack(originalMessage, false, false);
      return;
    }

    this.logger.log(`Received RFQ parsing job. trackingId=${trackingId}`);

    try {
      // 1. Extract raw text from different potential payloads (Next.js vs. Curl)
      let rawUserPrompt = '';
      if (data?.payload && typeof data.payload === 'object') {
        if (Array.isArray((data.payload as any).prompt) && (data.payload as any).prompt[0]?.parts?.[0]?.text) {
          rawUserPrompt = (data.payload as any).prompt[0].parts[0].text;
        } else if ((data.payload as any).fileData) {
          rawUserPrompt = (data.payload as any).fileData;
        } else {
          rawUserPrompt = JSON.stringify(data.payload);
        }
      } else {
        rawUserPrompt = (data.payload as any) || '';
      }

      if (!rawUserPrompt) {
        throw new Error('Unable to extract a valid user prompt text string.');
      }

      // 2. Append processing audit log snapshot row
      await this.rfqsParsingService.updateRfqLedgerStatus(trackingId, 'PROCESSING');

      // 3. Call AI with normalized text string
      const aiResponse = await this.callExternalAiService(rawUserPrompt);
      
      // 4. Persist data assets and publish downstream
      await this.saveParsedRfqData(trackingId, aiResponse, data);

      // 5. Append final completion log row
      await this.rfqsParsingService.updateRfqLedgerStatus(trackingId, 'COMPLETED');

      channel.ack(originalMessage);
      this.logger.log(`Acknowledged RFQ parsing job successfully. trackingId=${trackingId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing RFQ parsing job. trackingId=${trackingId}`, error instanceof Error ? error.stack : errorMessage);

      await this.rfqsParsingService
        .updateRfqLedgerStatus(trackingId, 'FAILED', errorMessage)
        .catch((dbErr) => {
          this.logger.error(`Failed to record terminal failure state. trackingId=${trackingId}`, dbErr);
        });

      channel.nack(originalMessage, false, false);
    }
  }

  private async callExternalAiService(payload: string): Promise<any> {
    const aiApiUrl = process.env.AI_API_URL;
    if (!aiApiUrl) {
      throw new Error('Missing env var AI_API_URL');
    }

    const systemInstruction =
      'System: Extract into JSON with keys: product_name, quantity, destination, timeline_weeks, sample_required, target_price_usd, special_instructions.';

    const requestBody = {
      model: 'granite4.1:3b',
      prompt: `${systemInstruction}\n\nUser: ${payload}`,
      stream: false,
      format: 'json',
    };

    const response$ = this.httpService.post(aiApiUrl, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000, // Safe 5-min timeout limit for local model generation
    });

    const result = await firstValueFrom(response$);

    let finalOutput = result.data;
    if (result.data && typeof result.data.response === 'string') {
      try {
        finalOutput = JSON.parse(result.data.response);
      } catch {
        finalOutput = result.data.response;
      }
    }

    return finalOutput;
  }

private async saveParsedRfqData(
  trackingId: string,
  aiResponse: any,
  originalData: RFQDataPayload
): Promise<void> {
  const prisma = this.databaseService.getPrismaClient();
  const rfqId = crypto.randomUUID(); 

  const SYSTEM_UUID = 'a1b2c3d4-0000-0000-0000-000000000001'; 
  const incomingBuyerId = (originalData as any).metadata?.buyerId;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const buyerId = uuidRegex.test(incomingBuyerId) ? incomingBuyerId : SYSTEM_UUID;

  const commodityType = aiResponse?.product_name || 'Unknown Commodity';
  const rawQuantity = parseInt(aiResponse?.quantity, 10);
  const quantity = Number.isNaN(rawQuantity) ? 0 : rawQuantity;
  const technicalSpecs = aiResponse?.special_instructions || null;

  const timelineWeeks = parseInt(aiResponse?.timeline_weeks, 10) || 4;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + timelineWeeks * 7);

  const requiredCertificates: string[] = [];
  if (aiResponse?.sample_required === true || String(aiResponse?.sample_required).toLowerCase() === 'true') {
    requiredCertificates.push('PRE_ORDER_SAMPLE_REQUIRED');
  }
  if (aiResponse?.target_price_usd) {
    requiredCertificates.push(`TARGET_PRICE_${aiResponse.target_price_usd}_USD`);
  }

  const technicalSpecsJson = technicalSpecs ? JSON.stringify({ notes: technicalSpecs }) : null;

  this.logger.log(`Persisting structural data records into primary business table with buyerId: ${buyerId}`);

  // Executing clean strings without inline comments inside backticks
  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO rfqs (
        id, buyer_id, commodity_type, quantity, unit, technical_specs, required_certificates, expires_at, status
      ) VALUES (
        ${rfqId},                         
        ${buyerId},  
        ${commodityType},                               
        ${quantity},                                    
        'units',                                     
        ${technicalSpecsJson},                              
        ${requiredCertificates},                        
        ${expiresAt},                                   
        'PENDING_REVIEW'                             
      )
    `,

    prisma.$executeRaw`
  INSERT INTO operational_ledger (
    id, 
    tenant_id,
    correlation_id, 
    event_type, 
    status, 
    payload, 
    created_at
  ) VALUES (
    ${crypto.randomUUID()},
   11111,                     
    ${trackingId},
    'RFQ_AI_PARSING',                                        -- Fits your NOT NULL event_type column
    'PARSING_COMPLETED',
    ${JSON.stringify({ aiParsedOutput: aiResponse })}::jsonb, -- Fixed: Matches your native jsonb column type
    NOW()
  )
`
  ]);

  try {
    const outboundPayload = {
      id: rfqId,
      correlationId: trackingId,
      buyerId: buyerId, 
      commodityType: commodityType,
      quantity: quantity,
      status: 'PENDING_REVIEW',
    };

    await this.messagingService.publishRfqComplianceVerificationEvent(
      outboundPayload as unknown as RFQDataPayload,
    );
    
    this.logger.log(`Successfully dispatched event payload for routing key: rfq.event.created`);
  } catch (publishError) {
    this.logger.error(`Failed to broadcast downstream creation event for RFQ ID: ${rfqId}`, publishError);
  }
}
}