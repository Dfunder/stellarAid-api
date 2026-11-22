# Security guidelines

This document defines the baseline security requirements for the StellarAid API. It applies to current code and to planned auth, wallet, and notification modules. Security decisions that affect HTTP responses are also described in [security headers](./security-headers.md).

## Configuration validation

Startup configuration is validated by `validateEnvironment` in `src/config/environment.ts`, which `src/main.ts` calls before creating the Nest application. Invalid values stop startup with an error that names the affected variable without printing its value.

- `NODE_ENV` must be `development`, `test`, or `production`.
- `PORT` must be an integer from `1` to `65535` and defaults to `3000`.
- `DATABASE_URL` must be a PostgreSQL URL and is required when `NODE_ENV=production`.
- `REDIS_URL`, when set, must be a Redis URL.
- `CORS_ORIGIN` is a comma-separated allowlist of bare `http(s)` origins. Wildcards, paths, query strings, and embedded credentials are rejected.
- `STELLAR_NETWORK` must be `testnet` or `public`.
- Numeric settings such as `REQUEST_TIMEOUT_MS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `PRISMA_SLOW_QUERY_MS`, and `REVOKED_TOKEN_RETENTION_DAYS` must be positive integers when set.
- Boolean feature flags such as `METRICS_ENABLED` and `REDIS_ENABLED` accept only `true` or `false`.

To add a variable, add it to `environmentSchema` with its type and constraints, update the relevant `.env.*.example` files with a placeholder value, document it here, and add a validation test. Never add a secret to a tracked example file or to an error message.

## Password and credential handling

Password-based login is not implemented yet. When it is added:

- Prefer Argon2id with per-password random salt and tuned memory, iteration, and parallelism parameters. Bcrypt is acceptable only when Argon2id is unavailable in the deployment target.
- Never store plaintext, reversible encrypted passwords, or passwords in logs, metrics, analytics events, or error reports.
- Enforce a minimum length of 12 characters and check new passwords against a breached-password list where practical.
- Hash on the server before any persistence or queue write. Client-side hashing does not replace server-side hashing.
- Rate-limit login, password reset, and verification attempts per account and per source IP, with exponential backoff after repeated failures.
- Compare secrets with constant-time helpers when a framework helper is not available.

## Token handling

- Prefer short-lived opaque access tokens stored server-side when the API controls the full session lifecycle. If JWTs are required, allowlist the expected algorithm and issuer, verify audience and expiry, and reject `alg: none`.
- Access tokens should expire within 15 minutes. Refresh tokens should be long-lived only when necessary, rotated on every refresh, and checked for reuse across all sessions.
- Store only token identifiers or hashes when a token must be looked up after issuance. Do not store raw bearer tokens.
- Support explicit revocation and logout. Revoked token identifiers should be retained only for the configured `REVOKED_TOKEN_RETENTION_DAYS` window and then deleted.
- Bind tokens to the minimum required scopes and audience. Admin and analytics operations remain fail-closed until role-based authorization is implemented.
- Send cookies with `HttpOnly`, `Secure`, and `SameSite=Lax` or stricter. Prefer bearer tokens in the `Authorization` header for first-party API clients.

## Nonce handling

Wallet and email-verification flows must treat nonces as single-use authentication material.

- Generate nonces with a cryptographically secure random source using at least 128 bits of entropy.
- Store only a hash of the nonce when the plaintext is not needed after issuance.
- Apply a short expiry, bind each nonce to its purpose and wallet address or email address, and delete it atomically on successful verification.
- Never log nonces, include them in URLs that are persisted by proxies, or reuse them across flows.

## Secret storage and rotation

- Load secrets from the process environment or a managed secret store. Never read them from committed files.
- Use distinct values per environment and rotate them when personnel change or exposure is suspected.
- Keep secrets out of source control, Swagger examples, analytics payloads, and stack traces. Redact `Authorization`, `Cookie`, `Set-Cookie`, and `x-api-key` headers, plus fields named `password`, `token`, `secret`, `apiKey`, or `privateKey`.
- Run `npm run security:secrets` locally before committing. CI runs `npm run security:check` on pushes and pull requests.
- For a full secret scan with Gitleaks, run `gitleaks detect --config .gitleaks.toml` when the Gitleaks CLI is installed.

## CORS

Cross-origin access is denied by default. The API no longer reflects arbitrary `Origin` headers when `CORS_ORIGIN` is unset.

- Set `CORS_ORIGIN` to an explicit comma-separated allowlist, for example `https://app.stellaraid.example,https://admin.stellaraid.example`.
- Keep credentials disabled unless a cookie-based auth flow is deliberately introduced. If credentials are enabled, the allowlist must contain exact origins, never `*`.
- Treat `CORS_ORIGIN` as a security control. Adding an origin grants browsers the ability to read authenticated API responses for users of that origin.
- Verify browser access with a preflight request after changing the allowlist.

## CSRF

Requests that authenticate with a bearer token in the `Authorization` header are not automatically sent by browsers, so they do not rely on ambient cookie authority. Cookie-based authentication changes that model and requires CSRF protection.

When cookie-based auth is introduced:

- Send CSRF tokens in a custom header, not only in a cookie, and validate them on every state-changing request.
- Prefer `SameSite=Strict` or `SameSite=Lax` cookies and set `Secure` and `HttpOnly`.
- Reject cross-origin state-changing requests whose `Origin` or `Referer` is not on the explicit CORS allowlist.
- Document the cookie and CSRF flow here before enabling it.

## NestJS implementation patterns

- Validate all inbound request bodies, query parameters, and route parameters with DTOs and `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Put authentication and authorization in guards, not in individual service methods. Deny by default.
- Keep secrets in the configuration layer and inject typed configuration rather than reading `process.env` throughout feature code.
- Use pipes and interceptors for redaction and error normalization so early failures still produce safe responses.
- Treat admin, media upload, and auth endpoints as high-risk areas: require explicit roles, validate file content before storage, and audit sensitive actions.

## References

- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [RFC 8725: JSON Web Token Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725)
