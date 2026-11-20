/**
 * Small, dependency-free helpers for #1033, #1034 and #1037.
 * Pure functions only, so a future cleanup job / payment service / cache layer can reuse them.
 */

/** #1033: expiry-based retention predicates for token tables (Prisma-style `where` objects). */
export function buildRetentionWhere(now: Date, retentionDays = Number(process.env.REVOKED_TOKEN_RETENTION_DAYS) || 30) {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  return {
    emailVerification: { createdAt: { lt: cutoff } },
    passwordReset: { OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null, lt: cutoff } }] },
    stellarNonce: { expiresAt: { lt: now } },
  };
}

/** #1034: validate a Stellar payment against an order before it may be marked paid. */
export interface PaymentCheck {
  destination: string;
  asset: string;
  amount: string;
  memo: string;
  source: string;
  createdAt: Date;
}

export function validatePayment(
  expected: Omit<PaymentCheck, 'createdAt'> & { intentExpiresAt: Date },
  actual: PaymentCheck,
): { ok: boolean; reason?: string } {
  if (actual.destination !== expected.destination) return { ok: false, reason: 'wrong destination' };
  if (actual.asset !== expected.asset) return { ok: false, reason: 'wrong asset' };
  if (Number(actual.amount) !== Number(expected.amount)) return { ok: false, reason: 'wrong amount' };
  if (actual.memo !== expected.memo) return { ok: false, reason: 'memo mismatch' };
  if (actual.source !== expected.source) return { ok: false, reason: 'wrong source wallet' };
  if (actual.createdAt > expected.intentExpiresAt) return { ok: false, reason: 'intent expired' };
  return { ok: true };
}

/** #1037: declare once which cache namespaces an artwork write must invalidate. */
export const ARTWORK_CACHE_NAMESPACES = ['artworks:list', 'search', 'marketplace'] as const;

export async function invalidateArtworkCaches(invalidate: (ns: string) => Promise<unknown>): Promise<void> {
  await Promise.all(ARTWORK_CACHE_NAMESPACES.map((ns) => invalidate(ns)));
}
