import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

/** Evaluates the subset of Prisma `where` operators the cleanup job uses. */
function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Where[]).some((w) => matches(row, w));
    const value = row[key];
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      const ops = cond as { lt?: Date; not?: null; in?: unknown[] };
      if ('not' in ops && ops.not === null && value === null) return false;
      if (ops.lt !== undefined && !(value instanceof Date && value.getTime() < ops.lt.getTime())) return false;
      if (ops.in !== undefined && !ops.in.includes(value)) return false;
      return true;
    }
    return value === cond;
  });
}

function fakeTable() {
  const table = {
    rows: [] as Row[],
    findMany: vi.fn(async ({ where, take }: { where: Where; take: number }) =>
      table.rows.filter((r) => matches(r, where)).slice(0, take).map((r) => ({ id: r.id })),
    ),
    deleteMany: vi.fn(async ({ where }: { where: Where }) => {
      const before = table.rows.length;
      table.rows = table.rows.filter((r) => !matches(r, where));
      return { count: before - table.rows.length };
    }),
  };
  return table;
}

const { prismaMock, envMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {} as Record<'refreshToken' | 'emailVerification' | 'passwordReset' | 'stellarNonce', ReturnType<typeof fakeTable>>,
  envMock: { revokedTokenRetentionDays: 30 },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/config', () => ({ env: envMock }));
vi.mock('@/services', () => ({ prisma: prismaMock }));
vi.mock('@/utils', () => ({ logger: loggerMock }));

import { cleanupRefreshTokens } from './refresh-token-cleanup.service';

const NOW = new Date('2026-09-30T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY_MS);
const ahead = (days: number) => new Date(NOW.getTime() + days * DAY_MS);
const ids = (rows: Row[]) => rows.map((r) => r.id).sort();

beforeEach(() => {
  vi.clearAllMocks();
  envMock.revokedTokenRetentionDays = 30;
  prismaMock.refreshToken = fakeTable();
  prismaMock.emailVerification = fakeTable();
  prismaMock.passwordReset = fakeTable();
  prismaMock.stellarNonce = fakeTable();
});

describe('cleanupRefreshTokens', () => {
  it('deletes expired refresh tokens and revoked ones past the retention window', async () => {
    prismaMock.refreshToken.rows = [
      { id: 'expired', expiresAt: ago(1), revokedAt: null },
      { id: 'revoked-old', expiresAt: ahead(5), revokedAt: ago(31) },
      { id: 'revoked-recent', expiresAt: ahead(5), revokedAt: ago(1) },
      { id: 'valid', expiresAt: ahead(5), revokedAt: null },
    ];

    const stats = await cleanupRefreshTokens(NOW);

    expect(stats.refreshTokens).toBe(2);
    expect(ids(prismaMock.refreshToken.rows)).toEqual(['revoked-recent', 'valid']);
  });

  it('honours a configured retention period', async () => {
    envMock.revokedTokenRetentionDays = 90;
    prismaMock.refreshToken.rows = [
      { id: 'revoked-60d', expiresAt: ahead(5), revokedAt: ago(60) },
      { id: 'revoked-91d', expiresAt: ahead(5), revokedAt: ago(91) },
    ];

    await cleanupRefreshTokens(NOW);

    expect(ids(prismaMock.refreshToken.rows)).toEqual(['revoked-60d']);
  });

  it('deletes expired email verifications and keeps still-valid ones', async () => {
    prismaMock.emailVerification.rows = [
      { id: 'expired', expiresAt: ago(1), consumed: false, createdAt: ago(2) },
      { id: 'expired-consumed', expiresAt: ago(1), consumed: true, createdAt: ago(2) },
      { id: 'valid', expiresAt: ahead(1), consumed: false, createdAt: NOW },
    ];

    const stats = await cleanupRefreshTokens(NOW);

    expect(stats.emailVerifications).toBe(2);
    expect(ids(prismaMock.emailVerification.rows)).toEqual(['valid']);
  });

  it('deletes expired unconsumed password resets and keeps still-valid ones', async () => {
    prismaMock.passwordReset.rows = [
      { id: 'expired', expiresAt: ago(1), consumed: false, createdAt: ago(1) },
      { id: 'valid', expiresAt: ahead(1), consumed: false, createdAt: NOW },
    ];

    const stats = await cleanupRefreshTokens(NOW);

    expect(stats.passwordResets).toBe(1);
    expect(ids(prismaMock.passwordReset.rows)).toEqual(['valid']);
  });

  it('retains consumed password resets for the audit window, then prunes them', async () => {
    prismaMock.passwordReset.rows = [
      { id: 'consumed-recent', expiresAt: ago(1), consumed: true, createdAt: ago(1) },
    ];

    const first = await cleanupRefreshTokens(NOW);
    expect(first.passwordResets).toBe(0);
    expect(ids(prismaMock.passwordReset.rows)).toEqual(['consumed-recent']);

    const later = await cleanupRefreshTokens(new Date(NOW.getTime() + 31 * DAY_MS));
    expect(later.passwordResets).toBe(1);
    expect(prismaMock.passwordReset.rows).toEqual([]);
  });

  it('deletes expired stellar nonces and keeps still-valid ones', async () => {
    prismaMock.stellarNonce.rows = [
      { id: 'expired', expiresAt: ago(1), consumed: false },
      { id: 'expired-consumed', expiresAt: ago(1), consumed: true },
      { id: 'valid', expiresAt: ahead(1), consumed: false },
    ];

    const stats = await cleanupRefreshTokens(NOW);

    expect(stats.stellarNonces).toBe(2);
    expect(ids(prismaMock.stellarNonce.rows)).toEqual(['valid']);
  });

  it('returns and logs per-table counts with a total', async () => {
    prismaMock.refreshToken.rows = [{ id: 'r', expiresAt: ago(1), revokedAt: null }];
    prismaMock.emailVerification.rows = [{ id: 'e1', expiresAt: ago(1) }, { id: 'e2', expiresAt: ago(1) }];
    prismaMock.stellarNonce.rows = [{ id: 's', expiresAt: ago(1) }];

    const stats = await cleanupRefreshTokens(NOW);

    const expected = { refreshTokens: 1, emailVerifications: 2, passwordResets: 0, stellarNonces: 1, deleted: 4 };
    expect(stats).toEqual(expected);
    expect(loggerMock.info).toHaveBeenCalledWith('refresh-token-cleanup: run complete', expected);
  });

  it('deletes in batches of the configured size', async () => {
    prismaMock.stellarNonce.rows = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, expiresAt: ago(1) }));

    const stats = await cleanupRefreshTokens(NOW, { batchSize: 2, maxBatches: 10 });

    expect(stats.stellarNonces).toBe(5);
    expect(prismaMock.stellarNonce.deleteMany).toHaveBeenCalledTimes(3);
    for (const [args] of prismaMock.stellarNonce.findMany.mock.calls) {
      expect(args.take).toBe(2);
    }
  });

  it('stops after maxBatches so a run is bounded', async () => {
    prismaMock.stellarNonce.rows = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, expiresAt: ago(1) }));

    const stats = await cleanupRefreshTokens(NOW, { batchSize: 2, maxBatches: 3 });

    expect(stats.stellarNonces).toBe(6);
    expect(prismaMock.stellarNonce.rows).toHaveLength(4);
  });
});
