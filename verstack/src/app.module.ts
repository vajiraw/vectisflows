import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RfqsModule } from './rfqs/rfqs.module';
import { MessagingModule } from './shared/messaging/messaging.module';
import { HealthController } from './shared/messaging/health.controller';
import { DatabaseModule } from './shared/database';

@Module({
  imports: [MessagingModule.register(), DatabaseModule.forRoot(), RfqsModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
