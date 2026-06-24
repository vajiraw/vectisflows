import { Module } from '@nestjs/common';
import { RfqsParserController } from './rfqs-parser.controller';
import { RfqsParsingService } from './rfqs-parsing.service';
import { ConfigService } from '@nestjs/config';
import { MessagingModule } from '../shared/messaging/messaging.module';
import { DatabaseModule } from '../shared/database';

@Module({
  imports: [MessagingModule.register(), DatabaseModule.forRoot()],
  controllers: [RfqsParserController],
  providers: [RfqsParsingService, ConfigService],
  exports: [RfqsParsingService],
})
export class RfqsModule {}
