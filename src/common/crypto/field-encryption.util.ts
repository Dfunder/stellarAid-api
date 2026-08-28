/**
 * Field-level encryption at rest (#652).
 * Uses AES-256-GCM — the same approach used for wallet keys.
 * Set FIELD_ENCRYPTION_KEY as a 64-char hex string in the environment.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.FIELD_ENCRYPTION_KEY ?? '';

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error('FIELD_ENCRYPTION_KEY must be a 64-character hex string');
  }
  return Buffer.from(KEY_HEX, 'hex');
}

/** Encrypt a plaintext string. Returns "iv:authTag:ciphertext" base64. */
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/** Decrypt a value produced by encryptField. */
export function decryptField(ciphertext: string): string {
  const [ivHex, authTagHex, encHex] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !encHex) throw new Error('Invalid encrypted field format');
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}

/** True if a string looks like an encrypted field (iv:tag:cipher). */
export function isEncryptedField(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}
