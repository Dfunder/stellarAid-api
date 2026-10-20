# Contributing to lumora-services

This document explains how the repository is organized and the conventions every
change is expected to follow. It is the source of truth for structure and style
questions — when code and this document disagree, fix the code or update this
document in the same change.

## Prerequisites

- Node.js **>= 20**
- npm **>= 10**
- git

## Getting started

```bash
npm install          # also installs git hooks via the `prepare` script
cp .env.example .env # required — DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET have no defaults
docker compose up -d postgres # start PostgreSQL (health-checked)
npx prisma migrate deploy     # apply migrations to the local database
npm run dev
```

The server listens on `PORT` (default `3000`). Startup fails fast when the
database is unreachable. Sanity check it:

```bash
curl http://localhost:3000/health/live   # liveness — always 200
curl http://localhost:3000/health/ready  # readiness — 200 when DB (and optional Redis) are up
```

## npm scripts

| Script                 | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Start the dev server with ts-node-dev (restarts on file change) |
| `npm run build`        | Compile to `dist/` (tsc) and rewrite path aliases (tsc-alias)   |
| `npm start`            | Run the compiled server from `dist/`                            |
| `npm run typecheck`    | Type-check the project without emitting files                   |
| `npm run lint`         | Run ESLint over the repository                                  |
| `npm run lint:fix`     | Run ESLint and auto-fix what it can                             |
| `npm run format`       | Rewrite files with Prettier                                     |
| `npm run format:check` | Verify formatting without writing files                         |
| `npm test`             | Run the unit tests once (vitest)                                |
| `npm run test:watch`   | Run the unit tests in watch mode                                |

## Database (PostgreSQL + Prisma)

- Local/CI databases are provisioned with Docker Compose (`docker-compose.yml`):
  `postgres` on 5432 with a named volume and a health check, plus an isolated
  `postgres-test` instance on 5433 for CI.
- The schema lives in `prisma/schema.prisma`. Change a model, then create a
  migration against a running PostgreSQL for your `DATABASE_URL`:
  ```bash
  npx prisma migrate dev --name describe_the_change
  ```
- Prefer `npx prisma migrate deploy` in CI and for fresh environments.
- Seed the skill taxonomy with `npx prisma db seed` (idempotent — upserts by
  slug). Add new taxonomy entries to `prisma/seed.ts`.
- `src/services/prisma.service.ts` is the single access point for the Prisma
  client (bounded pool via `connection_limit`). Never `new PrismaClient`
  elsewhere.
- Auth tables (`User`, `RefreshToken`, `EmailVerification`, `PasswordReset`)
  use hard deletes — removing a user cascades to tokens.

### Schema conventions

- Tables owned elsewhere (`User`, `Artwork`, `Order`) are referenced as
  **plain indexed `String` columns** (`buyerId`, `sellerId`, `userId`,
  `artworkId`, `authorId`, `targetId`, `senderId`, `orderId`) — no
  cross-change Prisma relations. Wire the relations up once those tables land.
- In-branch references (`Transaction → Order/Commission`,
  `Deliverable → Commission`, `Review → Order/Commission`,
  `ReviewReply/ReviewReport → Review`, threads) are real relations.
- Money uses `Decimal @db.Decimal(12, 2)`; ratings are `SmallInt`; file sizes
  use `BigInt @db.BigInt`; IDs are `String @id @default(uuid())`.
- **CHECK constraints live in the migration SQL** (Prisma cannot express them):
  amounts are non-negative, `Transaction` links to an order XOR a commission
  (`num_nonnulls <= 1`), and `Review.rating` stays in 1–5. Keep them in sync
  when you modify those models.
- One review per order and one per commission is enforced by two separate
  `@@unique` constraints on NULLable columns (Postgres treats NULLs as
  distinct, so each constraint independently scopes its own column).
- Money records are immutable: `Transaction` FKs to `Order`/`Commission` use
  `onDelete: Restrict`.
- Many-to-many junctions (`ArtworkMedia`, `PortfolioMedia`, `OrderDeliverable`)
  use composite `@@id` and cascade deletes to the join rows; the `Media` row
  itself is retained for orphan sweeps.

### State machines

Documented at the top of `prisma/schema.prisma`, enforced in the service layer:

- `OrderStatus`: `PENDING → PROCESSING → COMPLETED → REFUNDED`, with
  `PENDING/PROCESSING → FAILED`.
- `CommissionStatus`: `PENDING → ACCEPTED → IN_PROGRESS → DELIVERED →
COMPLETED`; any state except `COMPLETED` may move to `CANCELLED`/`DISPUTED`.
- `DeliverableStatus`: `UPLOADED → SUBMITTED → ACCEPTED | REJECTED`.
- `ReviewReportStatus`: `OPEN → REVIEWING → RESOLVED | DISMISSED`.

## Password hashing

`src/utils/password.ts` exports `hashPassword` / `comparePassword` (bcrypt,
cost factor **12** in `BCRYPT_COST`). Compare is constant-time. Unit tests are
colocated: `src/utils/password.test.ts` (run with `npm test`).

## Health and lifecycle

- `/health` and `/health/live` are plain liveness probes (always 200).
- `/health/ready` checks the database (`SELECT 1`) and, when `REDIS_URL` is
  set, a TCP connect to Redis; it returns 503 when the database is down.
- `src/index.ts` connects the database before it starts listening and reverses
  the order on shutdown (drain in-flight requests → close the pool → exit) for
  `SIGTERM`/`SIGINT`.

## Project structure

```
src/
├── app.ts          # Express application factory (middleware + routers)
├── index.ts        # Entry point: starts the server, handles graceful shutdown
├── config/         # Reads and validates environment variables
├── controllers/    # HTTP handlers — thin, delegate to services
├── middlewares/    # Cross-cutting concerns (404s, error handler, auth, …)
├── queues/         # Background job queue definitions (BullMQ, placeholder)
├── routes/         # Route definitions mounted by app.ts via the api router
├── services/       # Business logic — no HTTP concepts in here
├── types/          # Shared cross-cutting types
├── utils/          # Small shared helpers (logger)
├── validators/     # Request validation schemas (placeholder)
└── workers/        # Background job processors (BullMQ, placeholder)
```

Folders that are placeholders today (`queues/`, `workers/`, `validators/`)
carry a doc comment explaining what belongs there. Delete a placeholder only
when the real module replaces it.

## Conventions

### Layering

A request flows through exactly one path:

```
route → controller → service
```

- **routes** define endpoints and delegate straight to controllers. No
  business logic lives here.
- **controllers** translate HTTP to service calls and shape the response. If a
  controller grows, the logic belongs in a service.
- **services** hold business logic and know nothing about HTTP — no `req`/`res`,
  no status codes.
- **validators** prove requests match the expected shape before they reach a
  controller.
- **middlewares** handle cross-cutting concerns for every request (error
  handling, 404s, and later auth or rate limiting).
- **queues / workers** own background processing: queues produce jobs, workers
  consume them. Keep both free of HTTP concerns.

### Naming

- Files are `kebab-case`.
- Feature files carry a role suffix: `health.controller.ts`,
  `donations.routes.ts`, `auth.validator.ts`, `error-handler.middleware.ts`.
- Infrastructure folders (`config/`, `utils/`, `types/`) use plain names
  (`env.ts`, `logger.ts`).
- Functions and variables are `camelCase`; types and interfaces are
  `PascalCase`.

### Imports and path aliases

`tsconfig.json` maps `@/*` to `src/*`.

- Cross-folder imports always use the alias: `import { env } from '@/config'`.
- Same-folder imports stay relative: `import { createApp } from './app'`.
- Import from the folder barrel (`@/services`), not deep paths
  (`@/services/health.service`) — each folder's `index.ts` is its public API.
- Never import your own module from its folder barrel. A module re-exported by
  that barrel must import shared dependencies from their direct module (for
  example, a service importing `prisma` from `@/services/prisma.service`). The
  barrel is for consumers outside the folder.
- Prefer `import type` for type-only imports.

### Environment variables

- Nothing outside `src/config/env.ts` may read `process.env`.
- The config module validates `process.env` with a Zod schema at startup and
  throws a clear, itemized error when a required variable is missing or a
  value is invalid (fail fast).
- `DATABASE_URL`, `JWT_SECRET` and `JWT_REFRESH_SECRET` are required;
  everything else has a default or is optional (see `.env.example`).
- Add new variables there, with validation and a sensible default, plus an
  entry in `.env.example`.
- There is no `dotenv` dependency. Pass variables through your shell, or run
  the built server with `node --env-file=.env dist/index.js`.

### Formatting and linting

- Prettier owns formatting (`.prettierrc`); ESLint owns code quality
  (`eslint.config.js`, flat config). `eslint-config-prettier` keeps the two out
  of each other's way.
- Run `npm run lint` and `npm run format:check` before pushing.

### Git hooks

- `husky` installs a pre-commit hook that runs `lint-staged`, which applies
  ESLint `--fix` and Prettier to staged `.ts` files (and Prettier to staged
  JSON/Markdown). Code that fails lint cannot be committed.
- Hooks are installed automatically by `npm install` (via the `prepare`
  script). If hooks seem missing, run `npm run prepare`.

## Adding a new endpoint

1. Create `src/services/<feature>.service.ts` with the business logic.
2. Create `src/controllers/<feature>.controller.ts` — a thin HTTP wrapper.
3. Create `src/routes/<feature>.routes.ts` **with the router factory**
   (`createFeatureRouter('<feature>')`) and validate inputs by passing Zod
   schemas from `src/validators/` to the `validate()` middleware.
4. Export the new pieces from each folder's `index.ts` barrel.
5. Mount the router in `src/routes/v1.routes.ts` under `/api/v1/`.
6. Add `@openapi` JSDoc tags to the route so it shows up in Swagger at
   `/api/docs`.
7. Run `npm run lint && npm run typecheck && npm run dev` and exercise the
   endpoint.

## Rate limits

- Global limiter (100/min) applies in `src/app.ts` to every request.
- Feature-specific limiters come from `src/middlewares/rate-limit.middleware.ts`:
  auth is 10/min via the router factory, password reset 3/min.
- With `REDIS_URL` set, limits use a Redis-backed store; otherwise a shared
  in-memory store is used (fine for a single instance / local dev).

## Authentication

- Session logic lives in `src/services/auth.service.ts` and
  `src/services/token.service.ts`; controllers are thin wrappers and routes
  only wire validators + handlers (see `src/routes/auth.routes.ts`).
- Access tokens are HS256 JWTs (payload `sub` + `role`) signed with
  `JWT_SECRET`; refresh tokens are opaque random values whose SHA‑256 is
  stored in `RefreshToken` and never leave the DB in plain form.
- Lifetimes come from `ACCESS_TOKEN_TTL` (string, `jsonwebtoken`-style, e.g.
  `15m`) and `REFRESH_TOKEN_TTL_DAYS` (integer). Both default and are
  validated in `src/config/env.ts` together with the two required secrets.
- Passwords are hashed with bcrypt cost factor 12 (`src/utils/password.ts`);
  never log or return a password hash.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):
`feat: add donation webhook endpoint`, `fix: guard against empty payloads`,
`chore: bump dependencies`.

## Fail fast on bad configuration

`src/config/env.ts` throws on invalid configuration at startup on purpose —
crashing during boot with a clear message beats misbehaving in production.
