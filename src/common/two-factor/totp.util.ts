import * as crypto from 'crypto';

/**
 * Minimal TOTP (RFC 6238) helpers for two-factor authentication, implemented
 * with Node's built-in crypto so no extra dependency is required.
 * See `docs/two-factor-auth.md`.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DIGITS = 6;
const PERIOD_SECONDS = 30;

/** Generate a new random base32-encoded TOTP secret for a user to enrol. */
export function generateTotpSecret(byteLength = 20): string {
  const bytes = crypto.randomBytes(byteLength);
  let bits = '';
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let secret = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return secret;
}

function base32Decode(secret: string): Buffer {
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/** Compute the current TOTP code for a secret. */
export function generateTotp(secret: string, atMs = Date.now()): string {
  return hotp(secret, Math.floor(atMs / 1000 / PERIOD_SECONDS));
}

/**
 * Verify a submitted TOTP token, allowing a ±1 step window to tolerate small
 * clock differences. Comparison is constant-time.
 */
export function verifyTotp(
  secret: string,
  token: string,
  atMs = Date.now(),
): boolean {
  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  for (let error = -1; error <= 1; error++) {
    const expected = hotp(secret, counter + error);
    if (
      expected.length === token.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
    ) {
      return true;
    }
  }
  return false;
}

/** Generate one-time recovery codes for account recovery when 2FA is lost. */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString('hex'),
  );
}
