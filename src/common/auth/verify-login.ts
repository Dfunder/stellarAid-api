import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export interface StoredCredential {
  salt: Buffer;
  hash: Buffer;
}

export async function hashPassword(
  password: string,
): Promise<StoredCredential> {
  const salt = randomBytes(16);
  return { salt, hash: await derive(password, salt) };
}

const DUMMY_SALT = randomBytes(16);

/**
 * Always performs one key derivation, even when the user does not exist, so
 * response time does not reveal which emails are registered.
 */
export async function verifyLogin(
  credential: StoredCredential | undefined,
  password: string,
): Promise<boolean> {
  const salt = credential?.salt ?? DUMMY_SALT;
  const candidate = await derive(password, salt);
  if (credential === undefined) return false;
  return (
    candidate.length === credential.hash.length &&
    timingSafeEqual(candidate, credential.hash)
  );
}
