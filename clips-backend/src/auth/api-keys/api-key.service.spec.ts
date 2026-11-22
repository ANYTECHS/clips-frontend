import { ApiKeyService } from './api-key.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ApiKeyService (Issue #1402)', () => {
  const prisma = {
    apiKey: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: ApiKeyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApiKeyService(prisma as any);
  });

  describe('createKey', () => {
    it('stores only the hash and returns the raw key once', async () => {
      prisma.apiKey.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'key-1', ...data }),
      );

      const { apiKey, rawKey } = await service.createKey({
        userId: 1,
        name: 'CI',
        scopes: ['clips:read'],
      });

      expect(rawKey).toMatch(/^ck_[0-9a-f]{48}$/);
      const saved = prisma.apiKey.create.mock.calls[0][0].data;
      expect(saved.keyHash).toBe(ApiKeyService.hash(rawKey));
      expect(saved.keyHash).not.toBe(rawKey);
      expect(saved.prefix).toBe(rawKey.slice(0, 12));
      expect(apiKey.scopes).toEqual(['clips:read']);
    });

    it('rejects unknown scopes', async () => {
      await expect(
        service.createKey({ userId: 1, name: 'x', scopes: ['admin:all'] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.apiKey.create).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    const rawKey = 'ck_' + 'a'.repeat(48);

    it('returns identity + scopes for a valid key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        userId: 5,
        scopes: ['clips:read'],
        keyHash: ApiKeyService.hash(rawKey),
        revokedAt: null,
        expiresAt: null,
      });
      prisma.apiKey.update.mockResolvedValue({});

      const result = await service.verify(rawKey);

      expect(result).toEqual({
        id: 'key-1',
        userId: 5,
        scopes: ['clips:read'],
      });
    });

    it('returns null for revoked keys', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        userId: 5,
        scopes: [],
        keyHash: ApiKeyService.hash(rawKey),
        revokedAt: new Date(),
        expiresAt: null,
      });

      expect(await service.verify(rawKey)).toBeNull();
    });

    it('returns null for expired keys', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        userId: 5,
        scopes: [],
        keyHash: ApiKeyService.hash(rawKey),
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      expect(await service.verify(rawKey)).toBeNull();
    });

    it('returns null for unknown keys', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      expect(await service.verify(rawKey)).toBeNull();
    });
  });

  describe('revokeKey', () => {
    it('revokes a key owned by the user', async () => {
      prisma.apiKey.findFirst.mockResolvedValue({ id: 'key-1', userId: 5 });
      prisma.apiKey.update.mockResolvedValue({
        id: 'key-1',
        revokedAt: new Date(),
      });

      await service.revokeKey(5, 'key-1');
      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'key-1' },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });

    it('throws NotFound for keys owned by someone else', async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);
      await expect(service.revokeKey(5, 'key-9')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
