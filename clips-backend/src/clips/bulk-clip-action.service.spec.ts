import { BulkClipActionService } from './bulk-clip-action.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { BulkClipActionDto } from './dto/bulk-clip-action.dto';

describe('BulkClipActionService (Issue #1401)', () => {
  const userId = 7;

  const prisma = {
    clip: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };
  const cloudinary = { deleteClip: jest.fn() };
  const clipsService = {
    preventPostedMint: jest.fn(),
    preventDoubleMint: jest.fn(),
  };
  const nftMintService = {
    validateClipOwner: jest.fn(),
    assertMintCooldown: jest.fn(),
  };
  const nftMintEnqueue = { enqueueMint: jest.fn() };

  let service: BulkClipActionService;

  const dto = (over: Partial<BulkClipActionDto> = {}): BulkClipActionDto => ({
    action: 'delete',
    clipIds: [1, 2],
    ...over,
  });

  const ownedClip = (id: number) => ({
    id,
    clipUrl: `https://res.cloudinary.com/x/video/upload/v1/clip-${id}.mp4`,
    thumbnail: null,
    video: { userId },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BulkClipActionService(
      prisma as any,
      cloudinary as any,
      clipsService as any,
      nftMintService as any,
      nftMintEnqueue as any,
    );
  });

  describe('delete', () => {
    it('deletes owned clips and reports per-item results', async () => {
      prisma.clip.findUnique
        .mockResolvedValueOnce(ownedClip(1))
        .mockResolvedValueOnce(null); // clip 2 missing
      prisma.clip.delete.mockResolvedValue({});

      const res = await service.execute(userId, dto());

      expect(res.action).toBe('delete');
      expect(res.results).toEqual([
        { clipId: 1, status: 'success' },
        { clipId: 2, status: 'skipped', reason: 'not_found_or_not_owned' },
      ]);
      expect(res.summary).toEqual({
        total: 2,
        succeeded: 1,
        failed: 0,
        skipped: 1,
      });
      expect(prisma.clip.delete).toHaveBeenCalledTimes(1);
      expect(cloudinary.deleteClip).toHaveBeenCalledWith(`clip-1`);
    });

    it('skips clips owned by another user', async () => {
      prisma.clip.findUnique.mockResolvedValue({
        ...ownedClip(1),
        video: { userId: 999 },
      });

      const res = await service.execute(userId, dto({ clipIds: [1] }));

      expect(res.results[0].status).toBe('skipped');
      expect(prisma.clip.delete).not.toHaveBeenCalled();
    });

    it('records a per-item failure without aborting the batch', async () => {
      prisma.clip.findUnique
        .mockResolvedValueOnce(ownedClip(1))
        .mockResolvedValueOnce(ownedClip(2));
      prisma.clip.delete
        .mockRejectedValueOnce(new Error('db exploded'))
        .mockResolvedValueOnce({});

      const res = await service.execute(userId, dto());

      expect(res.results[0]).toMatchObject({ clipId: 1, status: 'failed' });
      expect(res.results[1]).toMatchObject({ clipId: 2, status: 'success' });
      expect(res.summary.failed).toBe(1);
      expect(res.summary.succeeded).toBe(1);
    });
  });

  describe('mint', () => {
    const mintDto = () =>
      dto({
        action: 'mint',
        creatorWallet:
          'GTESTWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      });

    it('requires creatorWallet for mint', async () => {
      await expect(
        service.execute(userId, dto({ action: 'mint' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('enqueues a mint job per clip and returns jobIds', async () => {
      nftMintEnqueue.enqueueMint
        .mockResolvedValueOnce({ jobId: 'job-1', delayed: false, delayMs: 0 })
        .mockResolvedValueOnce({ jobId: 'job-2', delayed: false, delayMs: 0 });

      const res = await service.execute(userId, mintDto());

      expect(nftMintService.assertMintCooldown).toHaveBeenCalledTimes(1);
      expect(nftMintEnqueue.enqueueMint).toHaveBeenCalledTimes(2);
      expect(res.results).toEqual([
        { clipId: 1, status: 'success', jobId: 'job-1' },
        { clipId: 2, status: 'success', jobId: 'job-2' },
      ]);
    });

    it('marks missing/unowned clips as skipped and conflicts as failed', async () => {
      nftMintService.validateClipOwner
        .mockRejectedValueOnce(new NotFoundException('Clip 1 not found'))
        .mockRejectedValueOnce(new NotFoundException('Clip 2 not found'))
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      clipsService.preventPostedMint.mockResolvedValue(undefined);
      clipsService.preventDoubleMint
        .mockRejectedValueOnce(
          Object.assign(new Error('already minted'), { getStatus: () => 409 }),
        )
        .mockResolvedValueOnce(undefined);
      nftMintEnqueue.enqueueMint.mockResolvedValue({
        jobId: 'job-3',
        delayed: false,
        delayMs: 0,
      });

      const res = await service.execute(userId, {
        ...mintDto(),
        clipIds: [1, 2, 3],
      });

      expect(res.results[0]).toMatchObject({
        clipId: 1,
        status: 'skipped',
        reason: 'not_found',
      });
      expect(res.results[1]).toMatchObject({
        clipId: 2,
        status: 'skipped',
        reason: 'not_found',
      });
      expect(res.results[2]).toMatchObject({
        clipId: 3,
        status: 'failed',
        reason: 'conflict',
      });
    });
  });
});
