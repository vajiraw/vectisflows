import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ParseRfqDto } from './dto/parse-rfq.dto';
import { MessagingService } from '../shared/messaging/messaging.service';
import { RFQDataPayload } from '../shared/messaging/interfaces/event-payload.interface';
import { DatabaseService } from '../shared/database/database.service';

const PARSING_PATTERN = 'rfq.raw_received';

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

  /**
   * Safely updates the operational state of an RFQ ledger tracking record via raw SQL.
   */
  public async updateRfqLedgerStatus(
    trackingId: string,
    status:
      | 'PENDING_ENQUEUE'    //saved to your database ledger, not yet confirmation from RabbitMQ
      | 'ENQUEUED'           // database write succeeded, RabbitMQ accepted message
      | 'FAILED_TO_ENQUEUE'  //database write succeeded,RabbitMQ failed definitively
      | 'PROCESSING'         // RabbitMQ accepted message, but processing not yet complete
      | 'COMPLETED'          // RabbitMQ accepted message, processing completed successfully
      | 'FAILED',            // RabbitMQ accepted message, but processing failed
    errorLog: string | null = null,
  ): Promise<void> {
    this.logger.debug(
      `Updating RFQ Ledger [Correlation ID: ${trackingId}] status to: ${status}`,
    );

    try {
      await this.databaseService
        .getPrismaClient()
        .$queryRawUnsafe(
          `UPDATE operational_ledger 
           SET status = $1, error_log = $2, updated_at = NOW()
           WHERE correlation_id = $3`,
          status,
          errorLog,
          trackingId,
        );

      this.logger.log(
        `Successfully transitioned tracking ID ${trackingId} to status: ${status}`,
      );
    } catch (databaseError) {
      this.logger.error(
        `CRITICAL DB ERROR: Failed to update ledger status for Tracking ID: ${trackingId} to ${status}`,
        databaseError instanceof Error ? databaseError.stack : databaseError,
      );
      throw databaseError;
    }
  }

  /**
   * Validates, tracks, persists, and streams the RFQ request down to the message broker.
   */
  async enqueueParsingJob(body: ParseRfqDto): Promise<string> {
    console.log('2. Service received body:', JSON.stringify(body));

    let payloadData: any;
    try {
      const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
      payloadData = parsedBody?.fileData || parsedBody?.prompt || '';
      
      if (!payloadData) {
        throw new Error('Payload data extracted is blank or missing valid attributes.');
      }
    } catch (parseError) {
      this.logger.error(
        'Failed to parse request body structural data',
        parseError,
      );
      throw new BadRequestException('Invalid request body payload format', {
        description:
          'The payload must contain either a valid fileData string or an AI prompt text.',
      });
    }

    const trackingId = randomUUID();

    const rfqPayload: RFQDataPayload = {
      id: trackingId,
      sourceType: 'pdf',
      payload: payloadData, 
      metadata: {},
      createdAt: new Date().toISOString(),
      createdBy: 'rfq-service',
    };

    // 1. Core Persistence Step
    try {
      await this.persistRfqOperationalLedger({
        rfqPayload,
        correlationId: trackingId,
        status: 'PENDING_ENQUEUE',
      });
    } catch (dbWriteError) {
      this.logger.error(
        `CRITICAL: Primary DB Write Failed for tracking ID: ${trackingId}. Systems degraded.`,
        dbWriteError instanceof Error ? dbWriteError.stack : dbWriteError,
      );

      // =========================================================================
      // TODO: PRIMARY DB DOWN FALLBACK IMPLEMENTATION
      // 1. Route data to local container volume scratchpad or fallback Redis cache cluster
      //    Example: await this.emergencyBackupService.dump(trackingId, rfqPayload);
      // 2. Ensure internal NestJS Logger emits an explicit ERROR severity level (done above)
      // 3. Reject with InternalServerErrorException or specialized fallback code to trigger upstream retries
      // =========================================================================
      
      throw new InternalServerErrorException('Data persistence failure. Request aborted due to primary database outage.');
    }

    // 2. Broker Streaming Step
    try {
      const published = await this.messagingService.publishRFQPayload(rfqPayload);

      if (published) {
        this.logger.log(
          `RFQ parsing job published with tracking ID: ${trackingId}`,
        );

        await this.updateRfqLedgerStatus(trackingId, 'ENQUEUED').catch((statusErr) => {
          this.logger.error(
            `Minor Consistency Warning: Message sent to RabbitMQ but failed to mark database status as ENQUEUED for ${trackingId}`,
            statusErr,
          );
        });

        return trackingId;
      } else {
        throw new Error(
          'Broker rejected message or returned negative acknowledgment',
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to enqueue tracking ID ${trackingId}. Marking ledger as failed.`,
        error instanceof Error ? error.stack : error,
      );

      await this.updateRfqLedgerStatus(trackingId, 'FAILED_TO_ENQUEUE', errorMessage).catch(
        (dbErr) => {
          this.logger.error(
            `CRITICAL: Could not update ledger failure state for ${trackingId}`,
            dbErr,
          );
        },
      );

      throw new InternalServerErrorException(
        'Failed to process and enqueue your parsing request',
      );
    }
  }
}