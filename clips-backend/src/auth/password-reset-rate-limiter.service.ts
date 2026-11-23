import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';

export const PASSWORD_RESET_LIMIT = 3;
export const PASSWORD_RESET_WINDOW_SECONDS = 60 * 60; // 1 hour

export interface PasswordResetRateLimitResult {
  allowed: boolean;
  /** Seconds until the tightest exhausted window resets (0 when allowed). */
  retryAfterSeconds: number;
}

/**
 * PasswordResetRateLimiterService
 *
 * Limits password-reset requests to PASSWORD_RESET_LIMIT per
 * PASSWORD_RESET_WINDOW_SECONDS, tracked independently per email and per IP.
 *
 * Every request is counted BEFORE the user lookup, so the limit behaves the
 * same whether or not the email belongs to an account — it can't be used to
 * enumerate users.
 *
 * Counters live in Redis. When Redis is unavailable the service falls back to
 * an in-process counter instead of failing open, so the endpoint can't be used
 * to spam inboxes during a Redis outage.
 */
@Injectable()
export class PasswordResetRateLimiterService {
  private readonly logger = new Logger(PasswordResetRateLimiterService.name);
  private readonly memory = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly redisService: RedisService) {}

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private keysFor(email: string, ip: string): string[] {
    const normalizedEmail = email.trim().toLowerCase();
    return [
      `pwreset:email:${this.hash(normalizedEmail)}`,
      `pwreset:ip:${this.hash(ip || 'unknown')}`,
    ];
  }

  /** Record one request and report whether it is within the limit. */
  async consume(email: string, ip: string): Promise<PasswordResetRateLimitResult> {
    const results = await Promise.all(
      this.keysFor(email, ip).map((key) => this.increment(key)),
    );

    const exceeded = results.filter((r) => r.count > PASSWORD_RESET_LIMIT);
    if (exceeded.length === 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(...exceeded.map((r) => r.ttlSeconds)),
    };
  }

  private async increment(
    key: string,
  ): Promise<{ count: number; ttlSeconds: number }> {
    if (this.redisService.isAvailable()) {
      const count = await this.redisService.incr(key);
      // incr returns 0 only when the Redis command failed.
      if (count > 0) {
        if (count === 1) {
          await this.redisService.expire(key, PASSWORD_RESET_WINDOW_SECONDS);
        }
        const ttl = await this.redisService.ttl(key);
        return {
          count,
          ttlSeconds: ttl > 0 ? ttl : PASSWORD_RESET_WINDOW_SECONDS,
        };
      }
    }

    this.logger.warn('Redis unavailable — using in-memory password reset rate limit');
    return this.incrementInMemory(key);
  }

  private incrementInMemory(key: string): { count: number; ttlSeconds: number } {
    const now = Date.now();
    let entry = this.memory.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + PASSWORD_RESET_WINDOW_SECONDS * 1000 };
      this.memory.set(key, entry);
    }
    entry.count += 1;

    // Opportunistically drop expired entries so the map can't grow unbounded.
    if (this.memory.size > 10_000) {
      for (const [k, v] of this.memory) {
        if (v.resetAt <= now) this.memory.delete(k);
      }
    }

    return {
      count: entry.count,
      ttlSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
}
