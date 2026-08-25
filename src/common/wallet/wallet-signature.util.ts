import { Keypair } from '@stellar/stellar-sdk';
import * as crypto from 'crypto';

/**
 * Helpers for verifying that a user controls the Stellar wallet they claim.
 *
 * Flow: the server issues a random challenge, the user signs it with their
 * wallet secret key, and the server verifies the signature against the wallet's
 * public key. See `docs/wallet-verification.md`.
 */

/** Generate a random challenge string for the user to sign. */
export function generateWalletChallenge(): string {
  return `stellar-aid-verify:${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Verify that `signatureBase64` is a valid signature of `challenge` produced by
 * the secret key corresponding to `publicKey` (a Stellar `G...` address).
 *
 * @returns `true` when the signature is valid, `false` otherwise (including on
 * a malformed public key or signature).
 */
export function verifyWalletSignature(
  publicKey: string,
  challenge: string,
  signatureBase64: string,
): boolean {
  try {
    const keypair = Keypair.fromPublicKey(publicKey);
    const signature = Buffer.from(signatureBase64, 'base64');
    return keypair.verify(Buffer.from(challenge, 'utf8'), signature);
  } catch {
    return false;
  }
}
