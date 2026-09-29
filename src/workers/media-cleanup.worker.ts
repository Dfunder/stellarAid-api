/**
 * Media cleanup worker — processes jobs from the `media-cleanup` queue.
 *
 * Degrades to a no-op (with a warning log) when Redis isn't configured,
 * matching the queue's own fallback.
 */

import { Worker } from 'bullmq';

import { env } from '@/config';
import { logger } from '@/utils';

import { cleanupOrphanedMedia } from '@/services';
import { createBullConnection } from '@/services/redis.service';
import { MEDIA_CLEANUP_QUEUE_NAME } from '@/queues';

let worker: Worker | undefined;

export function startMediaCleanupWorker(): Worker | undefined {
  if (env.redisUrl === undefined) {
    logger.warn('media-cleanup: REDIS_URL not configured, worker not started');
    return undefined;
  }

  worker = new Worker(
    MEDIA_CLEANUP_QUEUE_NAME,
    async () => {
      await cleanupOrphanedMedia();
    },
    { connection: createBullConnection() },
  );

  worker.on('failed', (job, error) => {
    logger.error('media-cleanup: job failed', {
      jobId: job?.id,
      message: error.message,
    });
  });

  return worker;
}
