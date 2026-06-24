import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ParseRfqDto } from './dto/parse-rfq.dto';
import { MessagingService } from '../shared/messaging/messaging.service';
import { RFQDataPayload } from '../shared/messaging/interfaces/event-payload.interface';
import { DatabaseService } from '../shared/database/database.service';

const PARSING_PATTERN = 'rfq.parse';

@Injectable()
export class RfqsParsingService {
  private readonly logger = new Logger(RfqsParsingService.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Persist a record of the RFQ payload into operational_ledger.
   */
  private async persistRfqOperationalLedger(params: {
    rfqPayload: RFQDataPayload;
    correlationId: string;
    tenantId?: string;
    status?: string;
    eventType?: string;
    errorLog?: string | null;
  }): Promise<string> {
    const {
      rfqPayload,
      correlationId,
      tenantId = 'default',
      status = 'PENDING',
      eventType = PARSING_PATTERN,
      errorLog = null,
    } = params;

    const created = await this.databaseService
      .getPrismaClient()
      .$queryRawUnsafe<any[]>(
        `INSERT INTO operational_ledger (tenant_id, correlation_id, event_type, status, payload, error_log)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         RETURNING id`,
        tenantId,
        correlationId,
        eventType,
        status,
        JSON.stringify(rfqPayload),
        errorLog,
      );

    const row = Array.isArray(created) ? created[0] : created;
    if (!row?.id) {
      throw new Error('Operational ledger insert did not return id');
    }

    return row.id as string;
  }

  async enqueueParsingJob(body: ParseRfqDto): Promise<string> {
    this.logger.log('Enqueuing RFQ parsing job');

    const trackingId = randomUUID();

    const rfqPayload: RFQDataPayload = {
      id: trackingId,
      sourceType: 'pdf',
      payload: body.fileData || body.prompt || '',
      metadata: {
        prompt: body.prompt,
      },
      createdAt: new Date().toISOString(),
      createdBy: 'rfq-service',
    };

    this.logger.debug(`Constructed RFQDataPayload: ${rfqPayload.id}`);

    await this.persistRfqOperationalLedger({
      rfqPayload,
      correlationId: trackingId,
    });

    try {
      const published = await this.messagingService.publishRFQPayload(rfqPayload);
      if (published) {
        this.logger.log(`RFQ parsing job published with tracking ID: ${trackingId}`);
      } else {
        this.logger.warn(`Publish returned false for tracking ID: ${trackingId}`);
      }
    } catch (error) {
      this.logger.error(
        'Error publishing RFQ payload:',
        error instanceof Error ? error.message : error,
      );
      throw new Error('Failed to enqueue parsing job');
    }

    return trackingId;
  }
}

