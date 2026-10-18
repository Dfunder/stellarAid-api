/**
 * Auth-token cleanup.
 *
 * Deletes rows that can never be used again:
 *  - refresh tokens: expired ones immediately, revoked ones once older than the
 *    audit retention window (`REVOKED_TOKEN_RETENTION_DAYS`);
 *  - email verifications and Stellar nonces: once expired;
 *  - password resets: unconsumed ones once expired, consumed ones once created
 *    before the audit retention window (the model has no `consumedAt`).
 *
 * Each table is pruned in id batches with a per-run cap so the daily job stays bounded.
 */

import { env } from '@/config';
import { logger } from '@/utils';
import { prisma } from '@/services';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CleanupOptions {
  readonly batchSize: number;
  readonly maxBatches: number;
}

const DEFAULT_OPTIONS: CleanupOptions = { batchSize: 1000, maxBatches: 100 };

export interface RefreshTokenCleanupStats {
  readonly refreshTokens: number;
  readonly emailVerifications: number;
  readonly passwordResets: number;
  readonly stellarNonces: number;
  readonly deleted: number;
}

async function deleteInBatches(
  find: (take: number) => Promise<Array<{ id: string }>>,
  remove: (ids: string[]) => Promise<{ count: number }>,
  { batchSize, maxBatches }: CleanupOptions,
): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < maxBatches; batch++) {
    const rows = await find(batchSize);
    if (rows.length === 0) break;
    const { count } = await remove(rows.map((row) => row.id));
    deleted += count;
    if (rows.length < batchSize) break;
  }
  return deleted;
}

export async function cleanupRefreshTokens(
  now: Date = new Date(),
  options: CleanupOptions = DEFAULT_OPTIONS,
): Promise<RefreshTokenCleanupStats> {
  const revokedCutoff = new Date(now.getTime() - env.revokedTokenRetentionDays * DAY_MS);

  const refreshTokenWhere = {
    OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null, lt: revokedCutoff } }],
  };
  const refreshTokens = await deleteInBatches(
    (take) => prisma.refreshToken.findMany({ where: refreshTokenWhere, select: { id: true }, take }),
    (ids) => prisma.refreshToken.deleteMany({ where: { ...refreshTokenWhere, id: { in: ids } } }),
    options,
  );

  const emailVerificationWhere = { expiresAt: { lt: now } };
  const emailVerifications = await deleteInBatches(
    (take) => prisma.emailVerification.findMany({ where: emailVerificationWhere, select: { id: true }, take }),
    (ids) => prisma.emailVerification.deleteMany({ where: { ...emailVerificationWhere, id: { in: ids } } }),
    options,
  );

  const passwordResetWhere = {
    OR: [
      { consumed: false, expiresAt: { lt: now } },
      { consumed: true, createdAt: { lt: revokedCutoff } },
    ],
  };
  const passwordResets = await deleteInBatches(
    (take) => prisma.passwordReset.findMany({ where: passwordResetWhere, select: { id: true }, take }),
    (ids) => prisma.passwordReset.deleteMany({ where: { ...passwordResetWhere, id: { in: ids } } }),
    options,
  );

  const stellarNonceWhere = { expiresAt: { lt: now } };
  const stellarNonces = await deleteInBatches(
    (take) => prisma.stellarNonce.findMany({ where: stellarNonceWhere, select: { id: true }, take }),
    (ids) => prisma.stellarNonce.deleteMany({ where: { ...stellarNonceWhere, id: { in: ids } } }),
    options,
  );

  const stats: RefreshTokenCleanupStats = {
    refreshTokens,
    emailVerifications,
    passwordResets,
    stellarNonces,
    deleted: refreshTokens + emailVerifications + passwordResets + stellarNonces,
  };
  logger.info('refresh-token-cleanup: run complete', { ...stats });
  return stats;
}
