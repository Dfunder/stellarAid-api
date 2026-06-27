# StellarAid API

Backend API for StellarAid, a Stellar-powered fundraising platform. The service is built with NestJS, Prisma, PostgreSQL, Redis, Bull queues, Socket.IO notifications, and Stellar network integrations.

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 16+ or a reachable PostgreSQL database
- Redis 7+ or a reachable Redis instance
- Docker and Docker Compose, optional but useful for local PostgreSQL and Redis

## Quick Start

1. Install dependencies.

```bash
npm install
```

2. Create your local environment file.

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

3. Start PostgreSQL and Redis.

If you already run PostgreSQL and Redis locally, make sure `DATABASE_URL` and `REDIS_URL` in `.env` match your services.

To use the repository Docker Compose dependencies:

```bash
docker compose up -d postgres redis
```

With the Compose defaults, use this database URL in `.env`:

```env
DATABASE_URL="postgresql://stellaraid:stellaraid@localhost:5432/stellaraid?schema=public"
REDIS_URL="redis://localhost:6379"
```

4. Apply the Prisma schema and generate the Prisma client.

```bash
npm run prisma:migrate
npm run prisma:generate
```

5. Start the API in watch mode.

```bash
npm run start:dev
```

The API listens on `http://localhost:3000` by default.

## Environment Variables

Copy `.env.example` to `.env` and adjust values for your machine. See `docs/environment.md` for the full required/optional reference and secrets management guidance.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | Runtime environment. Use `development` locally. |
| `PORT` | No | HTTP port. Defaults to `3000`. |
| `LOG_LEVEL` | No | Structured logger level. Defaults to `info`. |
| `ENABLE_SWAGGER` | No | Kept for local configuration; Swagger is currently mounted by the app. |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `POSTGRES_USER` | No | Docker Compose PostgreSQL username. |
| `POSTGRES_PASSWORD` | No | Docker Compose PostgreSQL password. |
| `POSTGRES_DB` | No | Docker Compose PostgreSQL database name. |
| `REDIS_URL` | Yes | Redis connection string used by queues, cache, throttling, and health checks. |
| `JWT_SECRET` | Yes | Secret used for JWT signing and validation. Change it outside local development. |
| `ADMIN_WALLETS` | No | Comma-separated Stellar public keys that receive the `ADMIN` role after auth. |
| `ADMIN_EMAILS` | No | Comma-separated email addresses for scheduled admin summaries. |
| `SMTP_HOST` | No | SMTP host for transactional email. If absent in development, emails are logged. |
| `SMTP_PORT` | No | SMTP port. Defaults to `587`. |
| `SMTP_USER` | No | SMTP username. |
| `SMTP_PASS` | No | SMTP password. |
| `EMAIL_FROM` | No | Sender address for outgoing emails. |
| `APP_BASE_URL` | No | Public base URL used in email links. |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name for uploads. |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key for uploads. |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret for uploads. |
| `CLOUDINARY_UPLOAD_PRESET` | No | Cloudinary upload preset. Defaults to `stellaraid-upload`. |
| `FRONTEND_URL` | No | CORS origin. Defaults to `http://localhost:3000`. |
| `JSON_BODY_LIMIT` | No | JSON request body limit. Defaults to `1mb`. |
| `FILE_UPLOAD_LIMIT` | No | URL-encoded body limit. Defaults to `5mb`. |
| `STELLAR_HORIZON_URL` | No | Stellar Horizon URL. Defaults to Stellar testnet Horizon. |
| `STELLAR_RPC_URL` | No | Soroban RPC URL. Defaults to Stellar testnet RPC. |
| `STELLAR_NETWORK_PASSPHRASE` | No | Stellar network passphrase. Defaults to testnet. |
| `STELLAR_SERVER_SECRET` | No | Server secret used by Soroban service when signing transactions. |
| `STELLAR_FEE_BUMP_SECRET` | No | Optional fee-bump secret for Stellar transactions. |

## Prisma Workflow

Prisma schema lives in `prisma/schema.prisma`.

```bash
# Create/apply local development migrations
npm run prisma:migrate

# Generate Prisma Client
npm run prisma:generate

# Apply existing migrations in production or CI
npm run prisma:deploy

# Open Prisma Studio
npm run prisma:studio
```

Production startup runs `npm run prisma:deploy` automatically before `npm run start:prod` through the `prestart:prod` lifecycle hook. See `docs/deployment.md` for the deployment runbook and rollback notes.

## Available Scripts

```bash
npm run start:dev     # Start NestJS in watch mode for local development
npm run start         # Start NestJS once
npm run build         # Compile TypeScript into dist/
npm run start:prod    # Run migrations, then start dist/main
npm run lint          # Run ESLint with auto-fix
npm run format        # Format source and test files
npm test              # Run unit tests
npm run test:e2e      # Run e2e tests
npm run test:cov      # Run tests with coverage
```

## API Entry Points

- Base URL: `http://localhost:3000`
- Swagger docs: `http://localhost:3000/api/docs`
- Health check: `GET /health`
- Readiness check: `GET /health/ready`
- Bull dashboard in non-production: `http://localhost:3000/admin/queues`

Main route groups include auth, users, campaigns, donations, milestones, contracts, Stellar helpers, notifications, newsletter, uploads, API keys, admin actions, disputes, and health checks.

## Architecture

The application uses Nest modules to keep domain logic separated. Prisma owns database access, Redis supports caching/throttling/queues, Bull handles background jobs, and Stellar services communicate with Horizon and Soroban RPC.

```mermaid
flowchart TD
  Client[Web or API Client] --> API[NestJS API]
  API --> Auth[Auth Module]
  API --> Campaigns[Campaigns Module]
  API --> Donations[Donations Module]
  API --> Admin[Admin Module]
  API --> Notifications[Notifications Module]
  API --> Stellar[Stellar Module]
  API --> Uploads[Uploads Module]

  Auth --> Prisma[Prisma Service]
  Campaigns --> Prisma
  Donations --> Prisma
  Admin --> Prisma
  Notifications --> Prisma

  API --> Redis[(Redis)]
  Notifications --> Queues[Bull Queues]
  Admin --> Queues
  Queues --> Redis

  Prisma --> Postgres[(PostgreSQL)]
  Stellar --> Horizon[Stellar Horizon]
  Stellar --> Soroban[Soroban RPC]
  Uploads --> Cloudinary[Cloudinary]
  Notifications --> SMTP[SMTP Provider]
```

## Project Structure

```text
src/
  admin/          Admin approvals, suspensions, disputes, summaries
  api-keys/       API key creation and guards
  auth/           Wallet challenge/verify/logout and JWT auth
  campaigns/      Campaign CRUD, updates, analytics, scoring
  common/         Shared guards, decorators, logging, Sentry middleware
  contracts/      Smart contract records and lookups
  donations/      Donation creation, verification, admin tip reporting
  health/         Database, Redis, and Stellar health checks
  milestones/     Milestone fund release workflows
  newsletter/     Newsletter subscribe/unsubscribe
  notifications/  In-app, email, WebSocket notifications
  prisma/         Prisma service and module
  queue/          Bull queue registration
  redis/          Redis cache module
  stellar/        Horizon, Soroban, pricing, transaction services
  throttler/      Redis-backed request throttling
  uploads/        Cloudinary upload helpers
  users/          Profiles, KYC, preferences, donation exports
```

## Local Development Notes

- Use `npm run start:dev` for day-to-day development.
- Keep PostgreSQL and Redis running before starting the API.
- If emails are not configured with SMTP credentials, development mode logs messages instead of sending them.
- Swagger is generated from the Nest application at `/api/docs`.
- Health checks validate PostgreSQL, Redis, and Stellar Horizon connectivity.

## Docker

Build and run the full stack:

```bash
docker compose up --build
```

For local development, it is often faster to run only dependencies with Docker:

```bash
docker compose up -d postgres redis
npm run start:dev
```
