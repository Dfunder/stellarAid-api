# Account Lockout After Failed Logins

Protects against brute-force attacks by locking an account after repeated failed
login attempts. Thresholds live in `src/auth/account-lockout.constants.ts`.

## Behaviour

- Each failed login increments a per-account `failedAttempts` counter.
- After `MAX_FAILED_ATTEMPTS` (5) consecutive failures the account is locked.
- Lockout is **progressive**: each additional failure doubles the lockout
  window (`getLockoutDurationMs`), starting at 1 minute and capped at 1 hour.
- A successful login resets the counter.

## Admin unlock

- Admins can clear the counter and lockout for an account via an admin endpoint,
  immediately restoring access.

## Security alerts

- When an account crosses the lockout threshold, a security alert (email) is
  sent to the account owner so they can react to a possible attack.
