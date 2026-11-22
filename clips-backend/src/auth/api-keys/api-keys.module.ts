import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyService } from './api-key.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { ScopesGuard } from './guards/scopes.guard';

/**
 * ApiKeysModule — Issue #1402
 *
 * Registers two global guards (order matters):
 *  1. ApiKeyAuthGuard — authenticates `X-API-Key` / `Bearer ck_...` requests
 *     before route-level guards run.
 *  2. ScopesGuard — enforces `@RequireScope()` metadata for API-key callers.
 *
 * PrismaModule and Reflector are globally available.
 */
@Module({
  controllers: [ApiKeysController],
  providers: [
    ApiKeyService,
    { provide: APP_GUARD, useClass: ApiKeyAuthGuard },
    { provide: APP_GUARD, useClass: ScopesGuard },
  ],
  exports: [ApiKeyService],
})
export class ApiKeysModule {}
