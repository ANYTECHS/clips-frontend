import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  API_KEY_PREFIX,
  API_SCOPES,
  ApiScope,
  isApiScope,
} from './api-key.constants';

export interface VerifiedApiKey {
  id: string;
  userId: number;
  scopes: string[];
}

/**
 * ApiKeyService — Issue #1402
 *
 * Issues, verifies and revokes API keys. Only the SHA-256 hash of a raw key
 * is persisted; the raw key is returned to the caller exactly once at
 * creation time and can never be retrieved again.
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private readonly prisma: PrismaService) {}

  static hash(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  /** Generate a new raw key. Format: `ck_<48 hex chars>`. */
  static generateRawKey(): string {
    return `${API_KEY_PREFIX}${randomBytes(24).toString('hex')}`;
  }

  /** Extract an API key from `X-API-Key` header or `Bearer ck_...`. */
  static extractKey(headers: Record<string, unknown>): string | undefined {
    const headerKey = headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }
    const auth = headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ck_')) {
      return auth.slice('Bearer '.length).trim();
    }
    return undefined;
  }

  async createKey(params: {
    userId: number;
    name: string;
    scopes: string[];
    expiresAt?: Date;
  }): Promise<{
    apiKey: VerifiedApiKey & { name: string; prefix: string };
    rawKey: string;
  }> {
    const invalid = params.scopes.filter((s) => !isApiScope(s));
    if (invalid.length) {
      throw new BadRequestException(
        `Unknown scope(s): ${invalid.join(', ')}. Valid scopes: ${API_SCOPES.join(', ')}`,
      );
    }

    const rawKey = ApiKeyService.generateRawKey();
    const keyHash = ApiKeyService.hash(rawKey);
    const prefix = rawKey.slice(0, 12);

    const record = await this.prisma.apiKey.create({
      data: {
        userId: params.userId,
        name: params.name,
        prefix,
        keyHash,
        scopes: params.scopes,
        expiresAt: params.expiresAt ?? null,
      },
    });

    this.logger.log(`API key created for user ${params.userId} (${record.id})`);

    return {
      apiKey: {
        id: record.id,
        userId: record.userId,
        name: record.name,
        prefix: record.prefix,
        scopes: record.scopes,
      },
      rawKey,
    };
  }

  /**
   * Verify a raw API key. Returns the key's identity + scopes, or null when
   * the key is unknown, revoked or expired. Updates lastUsedAt best-effort.
   */
  async verify(rawKey: string): Promise<VerifiedApiKey | null> {
    const keyHash = ApiKeyService.hash(rawKey);
    const record = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!record || record.revokedAt) return null;
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    // Constant-time comparison guards against timing attacks on the hash
    // lookup path (defence in depth — the DB lookup is already exact).
    const a = Buffer.from(keyHash);
    const b = Buffer.from(record.keyHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    this.prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return { id: record.id, userId: record.userId, scopes: record.scopes };
  }

  async listKeys(userId: number) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }

  async revokeKey(userId: number, keyId: string) {
    const record = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });
    if (!record) {
      throw new NotFoundException('API key not found');
    }
    return this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        revokedAt: true,
      },
    });
  }
}

export type { ApiScope };
