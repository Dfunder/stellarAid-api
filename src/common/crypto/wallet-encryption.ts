import * as crypto from 'crypto';

/**
 * Small helper for encrypting sensitive wallet data (e.g. wallet addresses)
 * at rest using AES-256-GCM.
 *
 * The 32-byte key is read from the `WALLET_ENCRYPTION_KEY` environment variable
 * (hex-encoded). See `docs/security/wallet-encryption.md` for the key rotation
 * strategy.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce recommended for GCM

function getKey(): Buffer {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('WALLET_ENCRYPTION_KEY environment variable is not set');
  }
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) {
    throw new Error('WALLET_ENCRYPTION_KEY must be a 32-byte (64 hex chars) key');
  }
  return buf;
}

/**
 * Encrypt a plaintext value. Returns a self-contained string of the form
 * `iv:authTag:ciphertext` (all hex), safe to store in the database.
 */
export function encryptWalletData(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a value produced by {@link encryptWalletData}.
 */
export function decryptWalletData(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Invalid encrypted wallet payload');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
