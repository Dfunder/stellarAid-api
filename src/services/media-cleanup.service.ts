/**
 * Orphaned media detection and cleanup.
 *
 * "Orphaned" means not referenced by any artwork, portfolio item, or order
 * deliverable — checked via the join tables directly (`none: {}`), so a
 * media record linked to any active entity is never a candidate. A media
 * row also has to be older than `GRACE_PERIOD_MS` before it's eligible,
 * so a just-uploaded file that hasn't been attached yet (e.g. mid
 * multi-step upload flow) isn't deleted out from under it.
 */

import { logger } from '@/utils';
import { prisma } from '@/services';

import { deleteObject } from './s3.service';

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export interface MediaCleanupStats {
  readonly scanned: number;
  readonly deleted: number;
  readonly failed: number;
}

export async function cleanupOrphanedMedia(): Promise<MediaCleanupStats> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);

  const orphaned = await prisma.media.findMany({
    where: {
      createdAt: { lt: cutoff },
      artworks: { none: {} },
      portfolio: { none: {} },
      deliverables: { none: {} },
    },
  });

  let deleted = 0;
  let failed = 0;

  for (const media of orphaned) {
    try {
      await deleteObject(media.bucket, media.key);
      await prisma.media.delete({ where: { id: media.id } });
      deleted += 1;
    } catch (error) {
      failed += 1;
      logger.error('media-cleanup: failed to delete orphaned media', {
        mediaId: media.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const stats: MediaCleanupStats = { scanned: orphaned.length, deleted, failed };
  logger.info('media-cleanup: run complete', stats);
  return stats;
}
