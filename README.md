# lumora-services

Express + TypeScript backend service.

## Requirements

- Node.js >= 20
- PostgreSQL 14+ (needed for the database and Prisma migrations)

## Quick start

```bash
npm install
cp .env.example .env
docker compose up -d postgres   # starts a health-checked PostgreSQL
npx prisma migrate deploy       # apply the schema migrations
npm run dev
```

`.env` must provide `DATABASE_URL`, `JWT_SECRET` and `JWT_REFRESH_SECRET`
(the defaults in `.env.example` work locally); startup fails fast otherwise.

Run the unit tests (`bcrypt` password util and friends) with `npm test`.
Optionally seed the skill taxonomy: `npx prisma db seed` (idempotent —
upserts by slug).

## Scripts

- `npm run dev` — dev server that restarts on file changes
- `npm run build` — compile to `dist/` (with path aliases rewritten)
- `npm start` — run the compiled build
- `npm run lint` / `npm run format` — code quality
- `npm test` — run the unit tests once (vitest)

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full script table, the project
structure and all conventions.

## Health check

```bash
curl http://localhost:3000/health        # liveness — always 200
curl http://localhost:3000/health/live   # liveness — always 200
curl http://localhost:3000/health/ready  # readiness — DB (and Redis when set)
```

`/health`:

```json
{ "status": "ok", "uptime": 4.2, "timestamp": "2026-09-23T09:00:00.000Z" }
```

`/health/ready` (healthy):

```json
{
  "status": "ready",
  "checks": { "database": "ok", "redis": "not_configured" },
  "timestamp": "2026-09-23T09:00:00.000Z"
}
```

`/health/ready` returns `503` when the database is unreachable. The port is
configurable with `PORT` — see `.env.example`.

## API versioning

All feature routes mount under `/api/v1/` (`/api/v1/auth`, `/api/v1/users`,
`/api/v1/artworks`, …). Feature routers are produced by the router factory in
`src/routes/router-factory.ts`. The legacy `/health` probe stays at the root.

## Documentation

Swagger UI is served at http://localhost:3000/api/docs. The OpenAPI 3 spec is
assembled by swagger-jsdoc from `src/swagger.ts` plus `@openapi` JSDoc
annotations in `src/routes/**/*.routes.ts`.

## Rate limiting

| Scope            | Limit   | Header                                            |
| ---------------- | ------- | ------------------------------------------------- |
| Global (all API) | 100/min | RateLimit-Limit / Remaining / Reset               |
| Auth endpoints   | 10/min  | RateLimit-Limit / Remaining / Reset + Retry-After |
| Password reset   | 3/min   | RateLimit-Limit / Remaining / Reset + Retry-After |

Over-limit requests return `429`. Without `REDIS_URL`, each limiter uses its own in-memory store within the
current process. This is sufficient for a single instance, but limits are not
shared between multiple instances. Set `REDIS_URL` to use a Redis-backed store
so limits hold across instances. Requests to `/api/docs` and `OPTIONS` are not counted.

## Request validation

Incoming `body` / `params` / `query` are validated against Zod schemas in
`src/validators/` by the `validate()` middleware. Invalid requests return
`422` with field-level errors and never reach a controller; controllers read
parsed data through `getValidated()`.

## Auth

| Endpoint                     | Purpose                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/register` | Create a user + verification record; returns a token pair and a verification token (201). |
| `POST /api/v1/auth/login`    | Exchange credentials for a token pair (200).                                              |
| `POST /api/v1/auth/refresh`  | Rotate the presented refresh token (single-use; 200).                                     |

Access tokens are HS256 JWTs signed with `JWT_SECRET`, live for
`ACCESS_TOKEN_TTL` (default `15m`). Refresh tokens are opaque 32-byte hex
values whose SHA‑256 hash is stored in `RefreshToken`; they expire after
`REFRESH_TOKEN_TTL_DAYS` (default `7`) and are revoked on rotation, so replay
of a used refresh token returns `401`. Login errors stay generic to avoid user
enumeration. The auth feature is rate-limited to 10 requests/minute through
the router factory.

## Header policy

Set in `src/app.ts`, in this order:

| Layer         | Policy                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `helmet`      | Helmet defaults: CSP, HSTS (production), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-DNS-Prefetch-Control`, and others. |
| `cors`        | Credentialed CORS. Origins come from `CORS_ORIGIN` (comma-separated). When unset, the request origin is reflected so any frontend can connect during development.   |
| `compression` | gzip/deflate encoding for compressible responses in every environment.                                                                                              |
| Request ID    | Every response carries `X-Request-Id` (incoming `X-Request-Id` is reused when present, otherwise a UUID is generated) and it appears in that request's log lines.   |

`X-Powered-By` is disabled.
