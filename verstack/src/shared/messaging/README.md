# DQMessaging - Shared RabbitMQ Messaging Module

## Overview

DQMessaging is a NestJS-based shared module providing production-ready RabbitMQ integration for the DQ AI processing pipeline. It handles the receipt of structural data payloads (PDFs, emails, foreign language documents) and manages the message queue for AI parsing operations.

## Architecture

```
src/shared/messaging/
├── messaging.module.ts          # Dynamic NestJS module definition
├── messaging.service.ts         # Main public API for pub/sub operations
├── messaging.constants.ts       # Exchange, queue, and routing key configurations
├── health.controller.ts         # Health check endpoints
├── interfaces/
│   ├── event-payload.interface.ts    # RFQDataPayload, RFQProcessingResult types
│   ├── messaging.interface.ts        # IMessagingService, IAmqpConnection contracts
│   └── index.ts
├── core/
│   ├── connection.provider.ts   # AMQP connection lifecycle management
│   ├── consumer.explorer.ts     # Message consumer discovery and management
│   └── index.ts
└── index.ts
```

## Configuration

Connection details are configured in `messaging.constants.ts`:

```typescript
const MESSAGING_CONFIG = {
  connection: {
    urls: ['amqp://sayul:sayul@172.25.28.123:5672'],
    connectionOptions: {
      reconnectTimeInSeconds: 5,
      heartbeatInterval: 30,
    },
  },
  exchanges: {
    RFQ_EXCHANGE: { name: 'rfq.exchange', type: 'direct', durable: true },
  },
  queues: {
    AI_PROCESSING: {
      name: 'queue.ai.processing',
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'rfq.ai.dlx',
        'x-dead-letter-routing-key': 'rfq.ai.dlq',
      },
    },
    DLQ: { name: 'rfq.ai.dlq', durable: true },
  },
  routingKeys: {
    STATUS_UPLOADED: 'rfq.status.uploaded',
  },
};
```

## Features

### 1. **Dynamic Module Registration**
```typescript
// In your app.module.ts
@Module({
  imports: [MessagingModule.register()],
})
export class AppModule {}
```

### 2. **Message Publishing**
```typescript
const payload: RFQDataPayload = {
  id: 'rfq-2024-001',
  sourceType: 'pdf',
  sourceLanguage: 'ja',
  payload: base64EncodedContent,
  metadata: { /* ... */ },
  createdAt: new Date().toISOString(),
  callbackUrl: 'https://api.example.com/rfq/results',
  timeoutMs: 30000,
};

await this.messaging.publishRFQPayload(payload);
```

### 3. **Message Consumption**
```typescript
await this.messaging.subscribeToAIProcessing(async (message: RFQDataPayload) => {
  console.log(`Processing RFQ: ${message.id}`);
  // Your AI processing logic (OCR, LLM extraction, etc.)
});
```

### 4. **Automatic Connection Management**
- Auto-reconnection with exponential backoff on connection loss
- Heartbeat monitoring (30-second intervals)
- Event handlers for graceful degradation
- Connection state verification

### 5. **Error Handling & Dead Letter Queue**
- Messages that fail processing are automatically routed to `rfq.ai.dlq`
- Configurable retry logic via queue arguments
- Detailed error logging for troubleshooting

### 6. **Health Checks**
```bash
# Check messaging service health
GET /health/messaging

# View registered consumers
GET /health/messaging/consumers
```

## Queue Specification

### Main Queue: `queue.ai.processing`
- **Purpose**: Receives structural data payloads (PDFs, emails, legacy documents, foreign language text)
- **Routing Key**: `rfq.status.uploaded`
- **Exchange**: `rfq.exchange` (type: direct)
- **Durable**: Yes (survives broker restarts)
- **Bindings**: DLX routing on processing failure

### Dead Letter Queue: `rfq.ai.dlq`
- **Purpose**: Captures messages that fail processing
- **Exchange**: `rfq.ai.dlx` (Dead Letter Exchange)
- **Use Case**: Troubleshooting, manual intervention, audit trail

## Message Types

### RFQDataPayload (Published to AI Processing Queue)
```typescript
interface RFQDataPayload {
  id: string;                              // Unique identifier
  sourceType: 'pdf' | 'email' | 'image' | 'plain_text' | 'legacy_document';
  sourceLanguage?: string;                 // ISO 639-1 code (e.g., 'ja', 'en')
  payload: string;                         // Base64 or plain text
  metadata?: Record<string, unknown>;      // Optional metadata
  createdAt: string;                       // ISO 8601 timestamp
  createdBy?: string;                      // Caller identifier
  callbackUrl?: string;                    // For async result delivery
  timeoutMs?: number;                      // Processing timeout
}
```

### RFQProcessingResult (Result from AI Module)
```typescript
interface RFQProcessingResult {
  payloadId: string;
  status: 'success' | 'failure' | 'partial';
  extractedData?: Record<string, unknown>;
  error?: string;
  processingMetadata?: {
    processingTimeMs?: number;
    confidence?: number;
    ocr_applied?: boolean;
    llm_applied?: boolean;
  };
  processedAt: string;
}
```

## Connection Details

- **RabbitMQ Server**: `amqp://sayul:sayul@172.25.28.123:5672`
- **Credentials**: `sayul` / `sayul`
- **Host**: `172.25.28.123`
- **Port**: `5672` (AMQP)
- **Heartbeat**: 30 seconds

## Integration Guide

### Step 1: Import Module
```typescript
import { MessagingModule } from './shared/messaging/messaging.module';

@Module({
  imports: [MessagingModule.register()],
})
export class YourModule {}
```

### Step 2: Inject Service
```typescript
constructor(private readonly messaging: MessagingService) {}
```

### Step 3: Publish or Subscribe
```typescript
// Publishing
await this.messaging.publishRFQPayload(payload);

// Subscribing
await this.messaging.subscribeToAIProcessing(handler);

// Health check
const healthy = await this.messaging.isHealthy();
```

## Error Handling

The module provides comprehensive error handling:

- **Connection Errors**: Auto-reconnection with exponential backoff
- **Publishing Errors**: Exceptions thrown with descriptive messages
- **Consumer Errors**: Failed messages auto-routed to DLQ
- **Health Checks**: Verify service availability before operations

## Performance Considerations

- **Prefetch**: Default set to 1 message per consumer (configurable)
- **Persistence**: All messages persisted to disk (durable: true)
- **Message Acknowledgment**: Manual ack only after successful processing
- **Heartbeat**: 30-second intervals prevent connection dropout

## Troubleshooting

### Connection Issues
```bash
# Check service health
curl http://localhost:3000/health/messaging

# Verify RabbitMQ is running
# ssh into 172.25.28.123 and check rabbitmq service
```

### Message Not Processing
1. Verify queue bindings: Check `queue.ai.processing` binding to `rfq.exchange` with routing key `rfq.status.uploaded`
2. Check consumer logs for errors
3. Verify DLQ for failed messages: `rfq.ai.dlq`

### Dead Letter Queue Inspection
```bash
# SSH into RabbitMQ host and inspect DLQ messages
rabbitmqctl list_queues name messages consumers
```

## Testing

Example unit test structure:
```typescript
describe('MessagingService', () => {
  let service: MessagingService;
  let amqpConnection: AmqpConnectionProvider;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MessagingService, AmqpConnectionProvider, ConsumerExplorer],
    }).compile();
    service = module.get(MessagingService);
    amqpConnection = module.get(AmqpConnectionProvider);
  });

  it('should publish a message', async () => {
    const payload: RFQDataPayload = { /* ... */ };
    const result = await service.publishRFQPayload(payload);
    expect(result).toBe(true);
  });
});
```

## Next Steps

1. **Integrate with AI Processing Module**: Connect this queue to your Python-based FastAPI/Celery AI parsing service
2. **Set up Callbacks**: Implement callback URL handling in your AI module to return results
3. **Monitor & Alert**: Set up monitoring for queue depth and DLQ activity
4. **Scale Consumers**: Deploy multiple instances of your consumer service for parallel processing

---

**Module Status**: ✓ Production Ready
**Last Updated**: 2024
