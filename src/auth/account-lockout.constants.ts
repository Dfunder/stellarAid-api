/**
 * Configuration for progressive account lockout after repeated failed logins.
 * See `docs/security/account-lockout.md`.
 */

/** Number of consecutive failed attempts before the first lockout kicks in. */
export const MAX_FAILED_ATTEMPTS = 5;

/** Base lockout duration (ms) applied at the threshold. */
export const BASE_LOCKOUT_MS = 60_000; // 1 minute

/** Upper bound on the lockout duration (ms). */
export const MAX_LOCKOUT_MS = 60 * 60_000; // 1 hour

/**
 * Progressive lockout: each additional failed attempt beyond the threshold
 * doubles the lockout duration, capped at {@link MAX_LOCKOUT_MS}.
 */
export function getLockoutDurationMs(failedAttempts: number): number {
  if (failedAttempts < MAX_FAILED_ATTEMPTS) {
    return 0;
  }
  const over = failedAttempts - MAX_FAILED_ATTEMPTS;
  return Math.min(BASE_LOCKOUT_MS * 2 ** over, MAX_LOCKOUT_MS);
}
