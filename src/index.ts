/**
 * Entry point — boots the HTTP server and manages graceful shutdown.
 *
 * Startup order:
 *   1. connect the database (fails fast when unreachable)
 *   2. start listening
 *
 * Shutdown order (SIGINT / SIGTERM):
 *   1. stop accepting connections and let in-flight requests finish
 *   2. close the database pool
 *   3. exit
 */

import { createApp } from './app';
import { env } from '@/config';
import { scheduleDailyMediaCleanup } from '@/queues';
import { connectDatabase, disconnectDatabase } from '@/services';
import { logger } from '@/utils';
import { startMediaCleanupWorker } from '@/workers';
import { startMediaWorker } from '@/workers';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let shuttingDown = false;

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
  } catch (error) {
    logger.error('Startup failed: database unreachable', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  const mediaCleanupWorker = startMediaCleanupWorker();
  await scheduleDailyMediaCleanup();

  const server = createApp().listen(env.port, () => {
    logger.info('Server started', {
      port: env.port,
      nodeEnv: env.nodeEnv,
      pid: process.pid,
    });
  });

  const mediaWorker = startMediaWorker();

  function shutdown(signal: NodeJS.Signals): void {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('Shutdown requested', { signal });
    server.close(() => {
      void (mediaCleanupWorker?.close() ?? Promise.resolve())
      void Promise.resolve(mediaWorker?.close())
        .catch(() => undefined)
        .then(() => disconnectDatabase())
        .catch((error) => {
          logger.error('Error closing database pool', {
            message: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          logger.info('Server stopped');
          process.exit(0);
        });
    });
    // If connections refuse to drain, force-exit after the timeout.
    const forceTimer = setTimeout(() => {
      logger.error('Forced shutdown: connections did not drain in time');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void bootstrap();
