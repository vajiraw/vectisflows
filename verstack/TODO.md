# TODO

- [ ] Inspect bootstrapping/logging setup (main.ts, logger config) to identify why “Starting Nest application…” appears twice
- [x] Update `src/main.ts` to ensure a single Winston/Nest logger instance is created and wired once
- [x] Re-run the app and confirm the message appears exactly twice total (per requirement)



Switching from an Update pattern to an Insert pattern for your status changes is an industry standard best practice known as an Audit Log or Event Ledger.Instead of overwriting history, you append new states. It is incredibly valuable for debugging, metrics tracking, and analytics because you can measure exactly how long each step took.Here is how to modify your database strategy to support this log-append architectural pattern.1. Adjusting the Database Schema ConceptTo make this work smoothly, your tracking table (e.g., operational_ledger) should have an auto-incrementing or unique id primary key for each log row, and a correlation_id (or tracking_id) to tie the various rows of a single request together:Row 1: Correlation ID XYZ $\rightarrow$ Status: PENDING (Created at 10:00:00)Row 2: Correlation ID XYZ $\rightarrow$ Status: PROCESSING (Created at 10:00:02)Row 3: Correlation ID XYZ $\rightarrow$ Status: COMPLETED (Created at 10:01:15)2. Refactoring the Code: From Update to InsertLet's look at the two places where status modifications happen in your RfqsConsumer.Modification A: Changing updateRfqLedgerStatus to an Append PatternInside your RfqsParsingService (or wherever your status updates live), make sure the raw query uses an INSERT INTO statement instead of an UPDATE statement.TypeScript// Inside your RfqsParsingService
async recordLedgerSnapshot(correlationId: string, status: string, errorMessage?: string): Promise<void> {
  const prisma = this.databaseService.getPrismaClient();

  // Every status transition gets its own brand new line item in the database
  await prisma.$executeRaw`
    INSERT INTO operational_ledger (
      id, 
      correlation_id, 
      status, 
      error_log, 
      created_at
    ) VALUES (
      ${crypto.randomUUID()},
      ${correlationId},
      ${status},
      ${errorMessage || null},
      NOW()
    )
  `;
}
Modification B: Updating the Final Transaction (saveParsedRfqData)When the AI returns a success response, we will write to the rfqs table and insert a final log snapshot line into the ledger.TypeScriptawait prisma.$transaction([
  // 1. Insert the clean, parsed asset into the primary business table
  prisma.$executeRaw`
    INSERT INTO rfqs (
      id, buyer_id, commodity_type, quantity, unit, technical_specs, required_certificates, expires_at, status
    ) VALUES (
      ${crypto.randomUUID()},                         
      ${originalData.metadata?.buyerId || 'system'},  
      ${commodityType},                               
      ${quantity},                                    
      'units',                                     
      ${technicalSpecsJson}, 
      ${requiredCertificates},                        
      ${expiresAt},                                   
      'PENDING_REVIEW'                             
    )
  `,

  // 2. FIXED FOR DEBUGGING: Insert a brand new historical entry line for the COMPLETED state
  prisma.$executeRaw`
    INSERT INTO operational_ledger (
      id, 
      correlation_id, 
      status, 
      payload, 
      created_at
    ) VALUES (
      ${crypto.randomUUID()},
      ${trackingId},
      'COMPLETED',
      ${JSON.stringify({ aiParsedOutput: aiResponse })}::json,
      NOW()
    )
  `
]);
3. How this supercharges your DebuggingBy adopting this append-only design, you can run a single analytical query to track bugs or monitor system health performance:SQLSELECT 
  status, 
  created_at,
  created_at - LAG(created_at) OVER (ORDER BY created_at) AS time_taken_for_step
FROM operational_ledger 
WHERE correlation_id = 'your-request-uuid-here'
ORDER BY created_at ASC;
This query will output exactly when the request was initialized, how long it sat in RabbitMQ before being picked up, and exactly how many seconds Ollama spent processing the token prompt generation before inserting the final RFQ asset.



next steps
1
Now that your background queue ingestion architecture is completely set up, type-safe, and logging histories instead of overwriting them, you are in an excellent position.Here are the logical next steps to proceed with to turn this into a bulletproof, production-ready feature:1. Build an Operational Dashboard APISince you are inserting a new record for every status change (PENDING $\rightarrow$ PROCESSING $\rightarrow$ COMPLETED/FAILED), you need a clean way to fetch this execution history.Add a simple GET endpoint to your RfqsController (e.g., /rfqs/track/:correlationId).Write a query that aggregates the ledger rows so frontend clients can see a real-time progress stepper or a detailed audit log if an AI process fails.
1. Build an Operational Dashboard APISince you are inserting a new record for every status change (PENDING $\rightarrow$ PROCESSING $\rightarrow$ COMPLETED/FAILED), you need a clean way to fetch this execution history.Add a simple GET endpoint to your RfqsController (e.g., /rfqs/track/:correlationId).Write a query that aggregates the ledger rows so frontend clients can see a real-time progress stepper or a detailed audit log if an AI process fails.


2
2. Implement the Dead Letter Queue (DLQ) Consumer
In your constants file, you beautifully configured a Dead Letter Exchange (rfq.ai.dlx) and Queue (rfq.ai.dlq). Currently, when your code catches an execution error or database crash, it executes channel.nack(originalMessage, false, false), routing the message directly to the DLQ.

Create a lightweight RfqsDeadLetterConsumer class.

Listen explicitly to rfq.ai.dlq.

Inside this handler, you can alert your engineering team (via Slack, email, or an internal monitoring system) that a payload broke the local AI parsing engine, ensuring no customer requests are silently dropped.

3. Graceful Extraction Refinements
Local models like granite4.1:3b can sometimes behave unpredictably if the user's raw input is completely unstructured or empty.

Add a robust validation layer (like class-validator or basic object checks) directly after receiving the array object back from JSON.parse(result.data.response).

If the AI fails to extract a proper product_name or quantity, fallback to safe structural defaults or flag the RFQ status specifically as MANUAL_REVIEW_REQUIRED instead of letting the entire database transaction throw an unexpected error.