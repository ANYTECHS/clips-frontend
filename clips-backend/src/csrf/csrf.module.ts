import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CsrfService } from './csrf.service';
import { CsrfGuard } from './csrf.guard';

/**
 * CSRF protection.
 *
 * Validation lives in a single place — the global CsrfGuard — so every
 * POST/PUT/PATCH/DELETE route is covered with the same exemption rules.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    CsrfService,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
  exports: [CsrfService],
})
export class CsrfModule {}
