/**
 * Media processing queue.
 *
 * Producer side of the image-processing pipeline: enqueues a job once a
 * client confirms an image upload finished. The worker (src/workers) does
 * the actual thumbnail/WebP generation.
 *
 * Degrades gracefully when `REDIS_URL` isn't configured (e.g. local dev
 * without Redis running) — `enqueueImageProcessing` becomes a no-op and
 * logs a warning, matching the rate-limit middleware's fallback behavior.
 */

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from '@/config';
import { logger } from '@/utils';

export const IMAGE_PROCESSING_QUEUE_NAME = 'image-processing';

export interface ImageProcessingJobData {
  readonly mediaId: string;
}

let queue: Queue<ImageProcessingJobData> | undefined;

function getQueue(): Queue<ImageProcessingJobData> | undefined {
  if (env.redisUrl === undefined) {
    return undefined;
  }
  if (queue === undefined) {
    const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue<ImageProcessingJobData>(IMAGE_PROCESSING_QUEUE_NAME, { connection });
  }
  return queue;
}

/** Enqueue thumbnail/WebP generation for a newly uploaded image. */
export async function enqueueImageProcessing(mediaId: string): Promise<void> {
  const q = getQueue();
  if (q === undefined) {
    logger.warn('Image processing queue unavailable (no REDIS_URL); skipping', { mediaId });
    return;
  }
  await q.add('process-image', { mediaId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
}
