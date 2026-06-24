import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ParseRfqDto } from './dto/parse-rfq.dto';
import { RfqsParsingService } from './rfqs-parsing.service';
import { ConfigService } from '@nestjs/config';

@Controller('api/v1/rfqs')
export class RfqsParserController {
  constructor(private readonly rfqsParsingService: RfqsParsingService) {}

  @Post('parse')
  @HttpCode(202)
  async parseText(@Body() body: ParseRfqDto): Promise<{ trackingId: string }> {
    console.log('Received RFQ parsing request:', body);
    const trackingId = await this.rfqsParsingService.enqueueParsingJob(body);
    return { trackingId };
  }
}
