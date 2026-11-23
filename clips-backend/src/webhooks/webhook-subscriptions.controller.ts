import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { WebhookSignature } from './webhook-signature';
import { CreateWebhookSubscriptionDto } from './dto/create-webhook-subscription.dto';

/**
 * WebhookSubscriptionsController — Issue #1400
 *
 * Lets authenticated users register HTTPS endpoints that receive
 * HMAC-SHA256-signed outbound webhook deliveries. The signing secret is
 * returned exactly once at creation.
 */
@ApiTags('Webhooks')
@ApiBearerAuth('access-token')
@Auth()
@Controller('webhooks/subscriptions')
export class WebhookSubscriptionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an outbound webhook subscription',
    description:
      'Registers an HTTPS endpoint for signed event deliveries. ' +
      'The returned `secret` is shown once — store it to verify ' +
      'X-Clips-Signature headers (see docs/webhooks.md).',
  })
  @ApiCreatedResponse({
    description: 'Subscription created',
    schema: {
      example: {
        id: 'sub_1',
        url: 'https://example.com/hooks/clips',
        events: ['earning.created'],
        secret: 'whsec_<48 hex chars>',
      },
    },
  })
  async create(@Body() dto: CreateWebhookSubscriptionDto, @Req() req: Request) {
    const userId = Number((req as any).user?.id ?? 0);
    const secret = WebhookSignature.generateSecret();

    const sub = await this.prisma.webhookSubscription.create({
      data: {
        userId,
        url: dto.url,
        secret,
        label: dto.label ?? null,
        events: dto.events,
      },
      select: {
        id: true,
        url: true,
        label: true,
        events: true,
        isActive: true,
        createdAt: true,
      },
    });

    return { ...sub, secret };
  }

  @Get()
  @ApiOperation({
    summary: 'List your webhook subscriptions (secrets are never returned)',
  })
  @ApiOkResponse({ description: 'Subscription list' })
  async list(@Req() req: Request) {
    const userId = Number((req as any).user?.id ?? 0);
    return this.prisma.webhookSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        label: true,
        events: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a webhook subscription' })
  @ApiOkResponse({ description: 'Subscription deleted' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    const userId = Number((req as any).user?.id ?? 0);
    const sub = await this.prisma.webhookSubscription.findFirst({
      where: { id, userId },
    });
    if (!sub) throw new NotFoundException('Webhook subscription not found');
    await this.prisma.webhookSubscription.delete({ where: { id } });
    return { deleted: true, id };
  }
}
