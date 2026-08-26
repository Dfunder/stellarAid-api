import { Keypair, StrKey } from '@stellar/stellar-sdk';

/**
 * Validates whether a string is a valid Stellar public key (ed25519 G-address).
 *
 * @param publicKey - The public key string to validate
 * @returns boolean indicating if the key is valid
 */
export function isValidStellarPublicKey(publicKey: string): boolean {
  if (!publicKey || typeof publicKey !== 'string') {
    return false;
  }
  try {
    return StrKey.isValidEd25519PublicKey(publicKey);
  } catch {
    return false;
  }
}

/**
 * Validates whether a string is a valid Stellar secret seed (ed25519 S-address).
 *
 * @param secretKey - The secret key string to validate
 * @returns boolean indicating if the secret key is valid
 */
export function isValidStellarSecretKey(secretKey: string): boolean {
  if (!secretKey || typeof secretKey !== 'string') {
    return false;
  }
  try {
    return StrKey.isValidEd25519SecretSeed(secretKey);
  } catch {
    return false;
  }
}

/**
 * Validates whether a string is a 64-character hexadecimal Stellar transaction hash.
 *
 * @param txHash - The transaction hash to validate
 * @returns boolean indicating if the hash is valid
 */
export function isValidTxHash(txHash: string): boolean {
  if (!txHash || typeof txHash !== 'string') {
    return false;
  }
  return /^[0-9a-fA-F]{64}$/.test(txHash);
}

/**
 * Formats a Stellar public key or address into an abbreviated string for UI display.
 * Example: `GA7Y...9XYZ`
 *
 * @param address - The full Stellar address
 * @param chars - Number of leading and trailing characters to keep (default: 4)
 * @returns Abbreviated address or empty string if invalid
 */
export function formatStellarAddress(address: string, chars = 4): string {
  if (!address || typeof address !== 'string') {
    return '';
  }
  if (address.length <= chars * 2 + 3) {
    return address;
  }
  const prefix = address.slice(0, chars);
  const suffix = address.slice(-chars);
  return `${prefix}...${suffix}`;
}

/**
 * Masks a Stellar wallet address for privacy and logging while retaining first 4 and last 4 characters.
 *
 * @param address - The wallet address to mask
 * @returns Masked address string
 */
export function maskWalletAddress(address: string): string {
  return formatStellarAddress(address, 4);
}
