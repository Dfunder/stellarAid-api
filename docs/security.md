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

## Untrusted content: input sanitization and output encoding

Campaign titles, descriptions, donation messages, display names, and any other field a user can type are untrusted. None of these fields exist yet; this section sets the rules so they are handled the same way from the first commit. Server-side controls are the baseline because downstream clients (web, mobile, email, exports) render the data in different contexts and cannot all be trusted to escape it.

### Principles

1. **Validate on input, encode on output.** Validation decides whether a value is acceptable. Encoding makes an accepted value safe in the specific place it is rendered. Neither replaces the other.
2. **Store the user's text as typed, once validated.** Do not HTML-escape before saving. Pre-escaped data is double-encoded when a client escapes it again, and it is wrong for non-HTML targets such as CSV, push notifications, or plain-text email. Encode at the output boundary for that target.
3. **Treat every sink separately.** SQL, HTML, URLs, HTTP headers, logs, CSV, and email subjects each need their own encoding. A value that is safe in one is not automatically safe in another.
4. **Prefer allowlists.** Define which characters, length, and format a field accepts instead of trying to list bad input.
5. **Fail closed.** Reject invalid input with a `400` error that names the field, not the offending value.

### At the API boundary (input)

Validate every body, query, and route parameter with DTOs and the global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` described below. For text fields:

- Set explicit `@MinLength` and `@MaxLength` (for example 3 to 120 characters for a title, up to 5,000 for a description) and an overall request body size limit. Unbounded text is a storage and denial-of-service risk.
- Use `@IsString()` and reject non-strings so objects and arrays cannot reach string handling code (this also blocks NoSQL-style operator injection if a document store is ever added).
- Normalize before validating: `trim()`, collapse internal whitespace where it is not meaningful, and apply Unicode NFC (`value.normalize('NFC')`) so visually identical strings compare equal.
- Strip control characters (U+0000 to U+001F except tab and newline, and U+007F). Reject or remove bidirectional override characters (U+202A to U+202E, U+2066 to U+2069) in single-line fields such as names and titles, because they can visually reorder text to spoof content.
- For fields that must be plain text, reject markup rather than trying to clean it. A `@Matches` allowlist or a check for `<` and `>` is simpler and safer than sanitizing.
- Only accept rich text (Markdown or HTML) when a feature genuinely requires it, and then follow the rich-text rules below.

```ts
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

// Removes control characters and bidi overrides, normalizes Unicode, trims.
const CONTROL_AND_BIDI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;

export function cleanText({ value }: { value: unknown }): unknown {
  return typeof value === 'string'
    ? value.normalize('NFC').replace(CONTROL_AND_BIDI, '').trim()
    : value;
}

export class CreateCampaignDto {
  @Transform(cleanText)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @Transform(cleanText)
  @IsString()
  @MaxLength(5000)
  description!: string;
}
```

Keep shared transforms such as `cleanText` in `src/common` so every content DTO uses the same rules and they can be unit tested once.

### Storage

- Always use Prisma's query API or tagged `$queryRaw` templates, which send values as bound parameters. Never build SQL by concatenating or interpolating user input, and never pass user input to `$queryRawUnsafe` or `$executeRawUnsafe`.
- Size columns to the validated maximum lengths so the database enforces the same limits as the DTO.
- Do not store derived HTML. If a rendered version is needed for performance, store it in a separate column, mark it as derived, and regenerate it when the sanitizer rules change.

### Output encoding

The API returns JSON with `Content-Type: application/json`, which Nest sets by default and `X-Content-Type-Options: nosniff` (see [security headers](./security-headers.md)) keeps browsers from treating as HTML. Return user text as JSON string values and never as pre-built HTML fragments.

Clients must encode for the context they render into. Document these expectations in the API docs for any endpoint that returns user-generated content:

| Context | Required handling |
| --- | --- |
| HTML element text | Use the framework's default escaping (React, Vue, and Angular escape text interpolation). Do not use `innerHTML`, `dangerouslySetInnerHTML`, or `v-html` with API content. |
| HTML attribute | Always quote attributes and escape `"`, `'`, `&`, `<`, and `>`. Never place user text in event handler attributes or `style`. |
| URL | Validate the scheme against an allowlist (`https:`, and `mailto:` where needed) before using a user-supplied link in `href` or `src`. Reject `javascript:`, `data:`, and `vbscript:`. Add `rel="noopener noreferrer"` to links that open new tabs. |
| JavaScript or JSON in a page | Serialize with `JSON.stringify` and escape `<` as `\u003c` before embedding in a `<script>` block. Never build script text with string concatenation. |
| CSV or spreadsheet export | Prefix cells that start with `=`, `+`, `-`, `@`, tab, or carriage return with a single quote to prevent formula injection, then apply normal CSV quoting. |
| Email and notifications | HTML-escape text in HTML templates, strip line breaks from subjects and header values to prevent header injection, and send a plain-text part. |
| Logs and error reports | Never log raw user content at `info` level or above. Escape or strip newlines so a value cannot forge log lines, and apply the redaction rules in [Secret storage and rotation](#secret-storage-and-rotation). |

### Rich text (only if a feature requires it)

- Prefer Markdown parsed with raw HTML disabled over accepting HTML.
- If HTML must be accepted, sanitize it on the server with a maintained allowlist sanitizer such as `sanitize-html`, or DOMPurify with `jsdom`. These are not installed today; add the dependency with the feature and pin its version. Do not write a sanitizer with regular expressions.
- Allow a minimal set of tags (for example `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, `a`), no inline styles, and only `href` on links with the URL scheme rules above. Sanitize on write, store the sanitized output, and re-sanitize on read if the allowlist changes.
- Enforce a Content Security Policy on any first-party page that renders user content, as a second layer of defence.

### File names and uploads

User-supplied file names are untrusted content too. Generate server-side storage names (for example a UUID), keep the original name only as a validated display field, strip path separators, and validate file type from content rather than the extension, as noted under [NestJS implementation patterns](#nestjs-implementation-patterns).

### Review checklist for new content fields

- [ ] DTO has `@IsString()`, explicit length limits, and the shared `cleanText` transform.
- [ ] Field is documented as plain text or rich text, and the output contexts clients must encode for are listed in the API docs.
- [ ] No raw SQL built from the value; the column length matches the DTO limit.
- [ ] The value is not logged, and is not placed in an HTTP header or email subject without line-break stripping.
- [ ] Any link field validates the URL scheme against an allowlist.
- [ ] Tests cover oversized input, control and bidi characters, markup such as `<script>alert(1)</script>`, `javascript:` links, and a CSV formula string such as `=HYPERLINK(...)`.

## NestJS implementation patterns

- Validate all inbound request bodies, query parameters, and route parameters with DTOs and `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- Put authentication and authorization in guards, not in individual service methods. Deny by default.
- Keep secrets in the configuration layer and inject typed configuration rather than reading `process.env` throughout feature code.
- Use pipes and interceptors for redaction and error normalization so early failures still produce safe responses.
- Treat admin, media upload, and auth endpoints as high-risk areas: require explicit roles, validate file content before storage, and audit sensitive actions.

## References

- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
- [RFC 8725: JSON Web Token Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725)
