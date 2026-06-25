import { Module } from '@nestjs/common';
import { RfqsParserController } from './rfqs-parser.controller';
import { RfqsParsingService } from './rfqs-parsing.service';

@Module({
  imports: [],
  controllers: [RfqsParserController],
  providers: [RfqsParsingService],
  exports: [RfqsParsingService],
})
export class RfqsModule {}
