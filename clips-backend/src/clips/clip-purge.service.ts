import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/** Clips stay recoverable for this long after soft delete before hard purge. */
export const CLIP_PURGE_RETENTION_DAYS = 90;
const PURGE_BATCH_SIZE = 500;

/**
 * ClipPurgeService — Issue #1405
 *
 * Hard-deletes clips whose `deletedAt` is older than the retention window
 * (90 days). Soft-deleted rows keep earnings and audit references intact
 * until this job permanently removes them; related rows cascade per the
 * Prisma schema (`Earning`, `ClipPost`, `ClipRoyalty`, `NftMintStatus`).
 */
@Injectable()
export class ClipPurgeService {
  private readonly logger = new Logger(ClipPurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *', {
    name: 'clip-soft-delete-purge',
    timeZone: 'UTC',
  })
  async purgeDeletedClips(): Promise<{ purged: number }> {
    const cutoff = new Date(
      Date.now() - CLIP_PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    let purged = 0;
    // Batch deletes so a large backlog cannot lock the table in one statement.
    for (;;) {
      const batch = await this.prisma.clip.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true },
        take: PURGE_BATCH_SIZE,
      });
      if (batch.length === 0) break;

      const { count } = await this.prisma.clip.deleteMany({
        where: { id: { in: batch.map((c) => c.id) } },
      });
      purged += count;
      if (batch.length < PURGE_BATCH_SIZE) break;
    }

    if (purged > 0) {
      this.logger.log(
        `Purged ${purged} clips soft-deleted before ${cutoff.toISOString()}`,
      );
    }

    return { purged };
  }
}
