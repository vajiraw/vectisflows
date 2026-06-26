import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RfqsParserController } from './rfqs-parser.controller';
import { RfqsParsingService } from './rfqs-parsing.service';
import { RfqsConsumer } from './rfqs-consumer.js';

@Module({
  imports: [HttpModule,],
  controllers: [RfqsParserController, RfqsConsumer],
  providers: [RfqsParsingService],
  exports: [RfqsParsingService],
})
export class RfqsModule {}
