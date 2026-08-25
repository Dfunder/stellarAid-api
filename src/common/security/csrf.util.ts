import * as crypto from 'crypto';

/**
 * Minimal helpers for CSRF token generation and validation.
 *
 * A random token is issued to the client (e.g. in a cookie) and must be echoed
 * back in a request header (`x-csrf-token`) for state-changing requests. The
 * comparison is constant-time to avoid leaking token bytes via timing.
 * See `docs/security/csrf.md`.
 */

/** Generate a new random CSRF token (hex-encoded, 32 bytes). */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate a submitted CSRF token against the expected token using a
 * constant-time comparison.
 */
export function validateCsrfToken(
  expected: string | undefined,
  actual: string | undefined,
): boolean {
  if (!expected || !actual || expected.length !== actual.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
