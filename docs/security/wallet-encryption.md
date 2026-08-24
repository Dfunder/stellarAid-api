# Wallet Data Encryption

Sensitive wallet data (e.g. wallet addresses) is encrypted at rest using
AES-256-GCM via `src/common/crypto/wallet-encryption.ts`
(`encryptWalletData` / `decryptWalletData`).

## Key management

- The encryption key is provided via the `WALLET_ENCRYPTION_KEY` environment
  variable as a 64-character hex string (32 bytes).
- The key is never committed to the repository and is injected through the
  deployment secret store.

## Key rotation strategy

1. Generate a new key and add it as `WALLET_ENCRYPTION_KEY_NEXT`.
2. Re-encrypt stored values: decrypt with the current key and re-encrypt with
   the new key in a background migration.
3. Promote `WALLET_ENCRYPTION_KEY_NEXT` to `WALLET_ENCRYPTION_KEY` and remove
   the old key once all records have been migrated.
4. Rotate keys on a fixed schedule (e.g. every 90 days) and immediately on any
   suspected compromise.

Because AES-256-GCM produces a random IV per record and stores the auth tag
alongside the ciphertext, each encrypted value is independently verifiable and
tamper-evident.
