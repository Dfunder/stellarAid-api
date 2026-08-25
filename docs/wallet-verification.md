# Wallet Signature Verification

Proves that a user controls the Stellar wallet they are linking to their
account, using a sign-a-challenge flow. Helpers live in
`src/common/wallet/wallet-signature.util.ts`.

## Flow

1. **Challenge** — the client requests a challenge for a public key
   (`GET /auth/wallet/challenge?publicKey=G...`). The server returns a random,
   single-use challenge string (`generateWalletChallenge()`) and stores it
   briefly against the session/user.
2. **Sign** — the wallet signs the challenge with its secret key.
3. **Verify** — the client submits the challenge and the base64 signature
   (`POST /auth/wallet/verify`). The server calls `verifyWalletSignature()`,
   which checks the signature against the public key.
4. **Associate** — on success the wallet's public key is associated with the
   authenticated user account.

## Notes

- Challenges are single-use and short-lived to prevent replay.
- Verification never requires the user's secret key — only the public key,
  challenge and signature.
