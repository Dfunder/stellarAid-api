# Two-Factor Authentication (2FA)

TOTP-based 2FA is provided by `src/common/two-factor/totp.util.ts` (RFC 6238,
built on Node's `crypto`, no extra dependency).

## Setup flow

1. `POST /auth/2fa/setup` — the server calls `generateTotpSecret()`, stores the
   secret against the user (encrypted at rest), and returns it plus an
   `otpauth://` URI so the client can render a QR code for an authenticator app.
2. The user scans the QR code and submits a code to confirm enrolment
   (`POST /auth/2fa/verify`), validated with `verifyTotp()`.
3. On success, `generateRecoveryCodes()` returns one-time recovery codes shown
   once to the user and stored hashed.

## Login flow

- After a successful password step, if the user has 2FA enabled the login is
  not complete until they submit a valid TOTP code (or a recovery code), checked
  with `verifyTotp()`.

## Notes

- `verifyTotp` allows a ±1 time-step window (30s each) to tolerate clock drift
  and uses a constant-time comparison.
- Recovery codes are single-use; consume and invalidate on use.
- SMS 2FA can be added later behind the same verification step.
