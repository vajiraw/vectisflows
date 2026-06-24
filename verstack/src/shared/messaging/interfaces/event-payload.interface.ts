/**
 * Standardized event payload for structural data received by AI processing queue.
 * Receives raw or unstructured buyer inputs (PDFs, emails, foreign language text).
 */
export interface RFQDataPayload {
  /**
   * Unique identifier for the RFQ batch/document
   */
  id: string;

  /**
   * Source type of the input data (pdf, email, image, plain_text, etc.)
   */
  sourceType: 'pdf' | 'email' | 'image' | 'plain_text' | 'legacy_document';

  /**
   * Language of the source document (ISO 639-1 code, e.g., 'en', 'ja', 'de')
   */
  sourceLanguage?: string;

  /**
   * Raw or unstructured data payload (base64 encoded for binary, text for plain text)
   */
  payload: string;

  /**
   * Optional metadata about the source document
   */
  metadata?: Record<string, unknown>;

  /**
   * Timestamp when the payload was created
   */
  createdAt: string;

  /**
   * Caller/system that created this message
   */
  createdBy?: string;

  /**
   * Optional callback URL for async processing results
   */
  callbackUrl?: string;

  /**
   * Request timeout in milliseconds
   */
  timeoutMs?: number;
}

/**
 * Response payload from AI processing module
 */
export interface RFQProcessingResult {
  /**
   * Original payload ID
   */
  payloadId: string;

  /**
   * Status of processing
   */
  status: 'success' | 'failure' | 'partial';

  /**
   * Extracted/processed structured data
   */
  extractedData?: Record<string, unknown>;

  /**
   * Error message if processing failed
   */
  error?: string;

  /**
   * Processing metadata
   */
  processingMetadata?: {
    processingTimeMs?: number;
    confidence?: number;
    ocr_applied?: boolean;
    llm_applied?: boolean;
  };

  /**
   * Timestamp of completion
   */
  processedAt: string;
}

/**
 * Message consumer options/handlers
 */
export interface MessageConsumerOptions {
  queue: string;
  handler: (msg: RFQDataPayload) => Promise<void>;
  prefetch?: number;
  noAck?: boolean;
}

/**
 * Publisher options
 */
export interface PublishOptions {
  exchange: string;
  routingKey: string;
  mandatory?: boolean;
  immediate?: boolean;
  timeout?: number;
}
