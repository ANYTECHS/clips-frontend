import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhooksGateway } from './webhooks.gateway';
import { OutboundWebhookService } from './outbound-webhook.service';
import { WebhookSubscriptionsController } from './webhook-subscriptions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EarningsModule } from '../earnings/earnings.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, EarningsModule, RedisModule],
  controllers: [WebhooksController, WebhookSubscriptionsController],
  providers: [WebhooksService, WebhooksGateway, OutboundWebhookService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
