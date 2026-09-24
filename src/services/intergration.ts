/**
 * Health service.
 *
 * Owns the liveness/readiness data surfaced by the health endpoints:
 * - liveness (`/health/live`) is always 200 while the process runs;
 * - readiness (`/health/ready`) checks the database and, when configured,
 *   Redis before reporting ready.
 */

import { connect, type Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import { env } from '@/config';
import { prisma } from './prisma.service';

export interface HealthStatus {
  readonly status: 'ok';
  readonly uptime: number;
  readonly timestamp: string;
}

export interface IntergrationStatus {
  readonly status: 'ready' | 'unavailable';
  readonly checks: {
    readonly database: 'ok' | 'error';
    readonly redis: 'ok' | 'error' | 'not_configured';
  };
  readonly timestamp: string;
}

export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

/** Liveness probe — always 200 while the process is alive. */
export function getLivenessStatus(): { readonly status: 'ok' } {
  return { status: 'ok' };
}

async function checkDatabase(): Promise<'ok' | 'error'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'ok';
  } catch {
    return 'error';
  }
}

function checkRedis(): Promise<'ok' | 'error' | 'not_configured'> {
  if (env.redisUrl === undefined) {
    return Promise.resolve('not_configured');
  }
  const url = new URL(env.redisUrl);
  const host = url.hostname || '127.0.0.1';
  const port = Number(url.port || 6379);
  const secure = url.protocol === 'rediss:';

  return new Promise((resolve) => {
    const socket: Socket | TLSSocket = secure
      ? (tlsConnect({ host, port }) as unknown as Socket)
      : connect({ host, port });
    let settled = false;

    const done = (state: 'ok' | 'error'): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(state);
    };

    socket.setTimeout(1000, () => done('error'));
    socket.once('connect', () => done('ok'));
    socket.once('error', () => done('error'));
  });
}

export async function getReadinessStatus(): Promise<ReadinessStatus> {
  const database = await checkDatabase();
  const redis = await checkRedis();
  const ready = database === 'ok';

  return {
    status: ready ? 'ready' : 'unavailable',
    checks: { database, redis },
    timestamp: new Date().toISOString(),
  };
}
