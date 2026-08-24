# CSRF Protection

State-changing requests are protected with the double-submit cookie pattern.

## Approach

1. On session start the server issues a random CSRF token
   (`generateCsrfToken()` in `src/common/security/csrf.util.ts`) and sets it in
   a cookie readable by the frontend.
2. For every state-changing request (`POST`/`PATCH`/`DELETE`) the client sends
   the same token back in the `x-csrf-token` header.
3. A validation middleware compares the header value against the cookie value
   using `validateCsrfToken()` (constant-time compare) and rejects mismatches
   with `403 Forbidden`.

## Notes

- Safe methods (`GET`, `HEAD`, `OPTIONS`) are exempt.
- Combine with `SameSite=Lax`/`Strict` cookies for defence in depth.
- Because the token is compared in constant time, token bytes are not leaked via
  response timing.
