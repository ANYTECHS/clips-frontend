import {
  ClipPurgeService,
  CLIP_PURGE_RETENTION_DAYS,
} from './clip-purge.service';

describe('ClipPurgeService (Issue #1405)', () => {
  const prisma = {
    clip: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  let service: ClipPurgeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClipPurgeService(prisma as any);
  });

  it('hard-deletes clips soft-deleted longer than the retention window', async () => {
    prisma.clip.findMany
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([]);
    prisma.clip.deleteMany.mockResolvedValue({ count: 2 });

    const res = await service.purgeDeletedClips();

    expect(res).toEqual({ purged: 2 });
    const where = prisma.clip.findMany.mock.calls[0][0].where;
    const cutoff = where.deletedAt.lt as Date;
    const expected = Date.now() - CLIP_PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(5000);
    expect(prisma.clip.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
    });
  });

  it('does nothing when no clips are past the retention window', async () => {
    prisma.clip.findMany.mockResolvedValue([]);

    const res = await service.purgeDeletedClips();

    expect(res).toEqual({ purged: 0 });
    expect(prisma.clip.deleteMany).not.toHaveBeenCalled();
  });

  it('batches deletes until no expired rows remain', async () => {
    const fullBatch = Array.from({ length: 500 }, (_, i) => ({ id: i + 1 }));
    prisma.clip.findMany
      .mockResolvedValueOnce(fullBatch)
      .mockResolvedValueOnce([{ id: 501 }])
      .mockResolvedValueOnce([]);
    prisma.clip.deleteMany
      .mockResolvedValueOnce({ count: 500 })
      .mockResolvedValueOnce({ count: 1 });

    const res = await service.purgeDeletedClips();

    expect(res).toEqual({ purged: 501 });
    expect(prisma.clip.deleteMany).toHaveBeenCalledTimes(2);
  });
});
