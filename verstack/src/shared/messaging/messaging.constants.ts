import 'dotenv/config';

export const MESSAGING_CONFIG = {
  connection: {
    // Only sensitive or environment-specific strings go to process.env
    urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
    connectionOptions: {
      reconnectTimeInSeconds:
        Number(process.env.RABBITMQ_RECONNECT_SECONDS) || 5,
      heartbeatInterval: Number(process.env.RABBITMQ_HEARTBEAT_SECONDS) || 30,
    },
  },
  exchanges: {
    RFQ_EXCHANGE: {
      name: 'rfq.exchange',
      type: 'direct',
      durable: true,
    },
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
    DLQ: {
      name: 'rfq.ai.dlq',
      durable: true,
    },
  },
  routingKeys: {
    STATUS_UPLOADED: 'rfq.status.uploaded',
  },
  bindings: [
    {
      exchange: 'rfq.exchange',
      queue: 'queue.ai.processing',
      routingKey: 'rfq.status.uploaded',
    },
  ],
} as const; // Makes the configuration immutable

// Injection tokens belong here in code, never in .env
export const DQ_MESSAGING_MODULE_IMPORT_TOKEN = 'DQ_MESSAGING_MODULE_IMPORT';
export const DQ_MESSAGING_SERVICE_TOKEN = 'DQ_MESSAGING_SERVICE';
export const DQ_AMQP_CONNECTION_TOKEN = 'DQ_AMQP_CONNECTION';
