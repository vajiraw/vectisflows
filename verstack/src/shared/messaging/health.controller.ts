import { Controller, Get } from '@nestjs/common';
import { MessagingService } from '../messaging/messaging.service';

/**
 * Health check controller for messaging service
 * Provides endpoints to verify RabbitMQ connectivity
 */
@Controller('health')
export class HealthController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('messaging')
  async getMessagingHealth() {
    const isHealthy = await this.messagingService.isHealthy();
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'messaging',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('messaging/consumers')
  getConsumers() {
    const consumers = this.messagingService.getRegisteredConsumers();
    return {
      count: consumers.size,
      consumers: Array.from(consumers.keys()),
    };
  }
}
