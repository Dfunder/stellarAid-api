/**
 * Media cleanup queue.
 *
 * A single repeatable job, scheduled to run daily. Degrades to a no-op
 * (with a warning log) when Redis isn't configured — BullMQ requires
 * Redis, and this job isn't critical-path for request handling.
 */

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from '@/config';
import { logger } from '@/utils';

export const MEDIA_CLEANUP_QUEUE_NAME = 'media-cleanup';
const DAILY_JOB_ID = 'media-cleanup-daily';
/** 03:00 every day — low-traffic hours, arbitrary but reasonable. */
const DAILY_CRON = '0 3 * * *';

let queue: Queue | undefined;

/** BullMQ requires its own connection with `maxRetriesPerRequest: null` —
 * distinct from the shared client in `redis.service.ts`, which doesn't set
 * that. */
function getQueue(): Queue | undefined {
  if (env.redisUrl === undefined) {
    return undefined;
  }
  if (queue === undefined) {
    const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue(MEDIA_CLEANUP_QUEUE_NAME, { connection });
  }
  return queue;
}

/**
 * Registers the daily repeatable cleanup job. Safe to call on every
 * startup — BullMQ dedupes repeatable jobs by `jobId`, so this doesn't
 * create duplicates across restarts.
 */
export async function scheduleDailyMediaCleanup(): Promise<void> {
  const q = getQueue();
  if (q === undefined) {
    logger.warn('media-cleanup: REDIS_URL not configured, skipping schedule');
    return;
  }
  await q.add('cleanup', {}, { repeat: { pattern: DAILY_CRON }, jobId: DAILY_JOB_ID });
}

/** Enqueues an immediate one-off cleanup run, outside the daily schedule. */
export async function enqueueMediaCleanupNow(): Promise<void> {
  const q = getQueue();
  if (q === undefined) {
    logger.warn('media-cleanup: REDIS_URL not configured, skipping enqueue');
    return;
  }
  await q.add('cleanup', {});
}
