import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { Auth } from '../decorators/auth.decorator';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/**
 * ApiKeysController — Issue #1402
 *
 * Manage the caller's own API keys. All endpoints require a JWT (browser
 * session) — keys cannot be used to manage other keys.
 */
@ApiTags('API Keys')
@ApiBearerAuth('access-token')
@Auth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an API key',
    description:
      'Returns the raw key exactly once — store it securely, it cannot be retrieved later. ' +
      'Only the SHA-256 hash is persisted.',
  })
  @ApiCreatedResponse({
    description: 'API key created',
    schema: {
      example: {
        apiKey: {
          id: 'ck_abc',
          name: 'CI pipeline',
          prefix: 'ck_ab12cd34ef56',
          scopes: ['clips:read'],
        },
        rawKey: 'ck_<48 hex chars>',
      },
    },
  })
  async create(@Body() dto: CreateApiKeyDto, @Req() req: Request) {
    const userId = Number((req as any).user?.id ?? 0);
    return this.apiKeyService.createKey({
      userId,
      name: dto.name,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List your API keys (raw keys are never returned)' })
  @ApiOkResponse({ description: 'API key metadata list' })
  async list(@Req() req: Request) {
    const userId = Number((req as any).user?.id ?? 0);
    return this.apiKeyService.listKeys(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiOkResponse({ description: 'Revoked API key metadata' })
  async revoke(@Param('id') id: string, @Req() req: Request) {
    const userId = Number((req as any).user?.id ?? 0);
    return this.apiKeyService.revokeKey(userId, id);
  }
}
