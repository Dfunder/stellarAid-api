import { Logger } from '@nestjs/common';

interface ErrorEmitter {
  on(event: 'error', listener: (error: Error) => void): unknown;
}

/**
 * Attach an `'error'` listener to a BullMQ Worker or Queue. Without one, a
 * Redis connection loss throws from the EventEmitter and takes the whole
 * process down, HTTP handlers included.
 */
export function attachErrorListener(
  emitter: ErrorEmitter,
  kind: 'worker' | 'queue',
  name: string,
  logger: Pick<Logger, 'error'> = new Logger('Queue'),
): void {
  emitter.on('error', (error) => {
    logger.error(`Queue ${kind} error (${name}): ${error.message}`);
  });
}

/** Retry policy shared by every producer; keeps retained jobs bounded. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
} as const;

/** Repeatable daily jobs must not be lost to one transient failure. */
export const DAILY_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 5,
} as const;
