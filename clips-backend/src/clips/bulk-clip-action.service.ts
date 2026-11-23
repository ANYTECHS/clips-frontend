import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from './cloudinary.service';
import { ClipsService } from './clips.service';
import { NftMintService } from './nft-mint.service';
import { NftMintEnqueueService } from './nft-mint-enqueue.service';
import type { BulkClipActionDto } from './dto/bulk-clip-action.dto';

export type BulkItemStatus = 'success' | 'failed' | 'skipped';

export interface BulkItemResult {
  clipId: number;
  status: BulkItemStatus;
  /** Mint job id when status=success and action=mint. */
  jobId?: string;
  /** Machine-readable reason for failed/skipped items. */
  reason?: string;
  /** Human-readable error detail for failed items. */
  error?: string;
}

export interface BulkClipActionResult {
  action: BulkClipActionDto['action'];
  results: BulkItemResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
}

/**
 * BulkClipActionService — Issue #1401
 *
 * Applies a single action (`delete` or `mint`) to up to 50 clips per request.
 * Every clip is processed independently: one bad clip never fails the batch,
 * and the response always contains a per-item result.
 */
@Injectable()
export class BulkClipActionService {
  private readonly logger = new Logger(BulkClipActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly clipsService: ClipsService,
    private readonly nftMintService: NftMintService,
    private readonly nftMintEnqueue: NftMintEnqueueService,
  ) {}

  async execute(
    userId: number,
    dto: BulkClipActionDto,
  ): Promise<BulkClipActionResult> {
    if (dto.action === 'mint' && !dto.creatorWallet) {
      throw new BadRequestException(
        'creatorWallet is required when action is "mint"',
      );
    }

    // Wallet-level mint cooldown applies to the whole request, not per clip.
    if (dto.action === 'mint') {
      await this.nftMintService.assertMintCooldown(dto.creatorWallet!);
    }

    const results: BulkItemResult[] = [];
    for (const clipId of dto.clipIds) {
      results.push(
        dto.action === 'delete'
          ? await this.deleteOne(userId, clipId)
          : await this.mintOne(userId, clipId, dto.creatorWallet!),
      );
    }

    const summary = {
      total: results.length,
      succeeded: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
    };

    this.logger.log(
      `Bulk ${dto.action} for user ${userId}: ${JSON.stringify(summary)}`,
    );

    return { action: dto.action, results, summary };
  }

  // ── delete ──────────────────────────────────────────────────────────────

  private async deleteOne(
    userId: number,
    clipId: number,
  ): Promise<BulkItemResult> {
    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      select: {
        id: true,
        clipUrl: true,
        thumbnail: true,
        video: { select: { userId: true } },
      },
    });

    if (!clip || clip.video.userId !== userId) {
      return { clipId, status: 'skipped', reason: 'not_found_or_not_owned' };
    }

    try {
      for (const url of [clip.clipUrl, clip.thumbnail]) {
        const publicId = this.extractPublicId(url);
        if (publicId) {
          try {
            void this.cloudinary.deleteClip(publicId);
          } catch (err) {
            this.logger.warn(
              `Cloudinary delete failed for clip ${clipId}: ${(err as Error).message}`,
            );
          }
        }
      }

      await this.prisma.clip.delete({ where: { id: clipId } });
      return { clipId, status: 'success' };
    } catch (error) {
      return this.failure(clipId, error);
    }
  }

  // ── mint ────────────────────────────────────────────────────────────────

  private async mintOne(
    userId: number,
    clipId: number,
    walletAddress: string,
  ): Promise<BulkItemResult> {
    try {
      await this.nftMintService.validateClipOwner(clipId, userId);
      await this.clipsService.preventPostedMint(clipId);
      await this.clipsService.preventDoubleMint(clipId);

      const job = await this.nftMintEnqueue.enqueueMint({
        clipId,
        walletAddress,
        userId,
      });

      return { clipId, status: 'success', jobId: job.jobId };
    } catch (error) {
      const status = this.isOwnershipError(error) ? 'skipped' : 'failed';
      const result = this.failure(clipId, error);
      return { ...result, status };
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private failure(clipId: number, error: unknown): BulkItemResult {
    const status = this.httpStatus(error);
    const message = error instanceof Error ? error.message : String(error);
    const reason =
      status === 404
        ? 'not_found'
        : status === 403
          ? 'not_owned'
          : status === 409
            ? 'conflict'
            : 'error';
    return { clipId, status: 'failed', reason, error: message };
  }

  private isOwnershipError(error: unknown): boolean {
    const status = this.httpStatus(error);
    return status === 404 || status === 403;
  }

  private httpStatus(error: unknown): number | undefined {
    const e = error as { getStatus?: () => number; status?: number };
    if (typeof e?.getStatus === 'function') return e.getStatus();
    return typeof e?.status === 'number' ? e.status : undefined;
  }

  /** Mirrors ClipsService.extractPublicId — Cloudinary public_id from a URL. */
  private extractPublicId(url: string | null): string | null {
    if (!url) return null;
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
