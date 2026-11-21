# 🌟 StellarAid

Blockchain-powered crowdfunding for global impact — transparent, borderless, and secure.
StellarAid is an open-source, decentralized crowdfunding platform built on the Stellar Network & Soroban smart contracts. It enables creators to raise funds in XLM or any Stellar-based asset, while donors enjoy transparent, verifiable on-chain contributions.
Whether it’s humanitarian campaigns, community causes, startups, or global charity projects — StellarAid brings trust, transparency, and financial accessibility to fundraising.

# 📖 About StellarAid

StellarAid empowers individuals and organizations to launch fundraising campaigns with full blockchain transparency.
The platform supports multi-asset contributions, verifiable donation trails, automated fund releases through Soroban smart contracts, and wallet-based authentication.

- 🔐 Decentralized & Secure — Wallet-based login, non-custodial flows
- 💸 Multi-Asset Support — XLM, USDC, NGNT, custom Stellar assets
- 📊 Transparent — Every donation visible and verifiable on-chain
- ⚙️ Modular & Open Source — Easy for contributors and developers

# 🏗 Organization Repositories

- stellarAid-api → Backend services (NestJS + PostgreSQL )
  - User authentication (wallet + email verification)
  - Campaign approval workflow
  - Donation tracking + analytics
  - Notifications (email/SMS)
  - Admin API endpoints

- the repo includes:

```
/docs        → Technical documentation
/examples    → Sample integrations
/scripts     → Dev and deployment utilities
```

# 🔑 How StellarAid Works

- 1️⃣ User connects Stellar wallet (Freighter, Albedo, Lobstr)
- 2️⃣ Creator launches a campaign → stored in backend + contract ref
- 3️⃣ Donors contribute using Stellar assets
- 4️⃣ Soroban contract escrows funds safely
- 5️⃣ Creators withdraw funds securely on-chain
- 6️⃣ Admin tools handle verification, fraud detection & analytics
  Everything is transparent, globally accessible, and verifiable.

# 🛠 Tech Stack

### ⚙️ Backend Services

- NestJS (modular monolith)
- PostgreSQL (primary data store)
- Redis (cache, rate-limits, nonce store)
- Nodemailer (notifications)

### 🗄 Data Layer

- PostgreSQL for core data
- Redis for caching + session flow
- Optional IPFS for media (campaign images, proofs)

# 🚀 Roadmap

### Phase 1 (MVP)

- User registration + wallet login
- Create & approve campaigns
- Donate using XLM/USDC
- Basic dashboard & on-chain transparency
- Core Soroban contract (escrow + withdraw)

### Phase 2

- Email verification + KYC workflow
- Advanced analytics
- Multi-asset campaign support
- Dispute handling
- Social login (GitHub/Twitter/Discord)

### Phase 3

- Automated payout schedules
- Community governance
- Cross-border NGO support
- Trust badges & identity verification

### Phase 4

- AI-driven fraud scoring
- Multi-chain campaign expansion
- Ecosystem grant program

# ⚙️ Environment Configuration

Configuration is read from process environment variables, with built-in defaults so the app can start without an environment file. Each environment has an example file documenting the supported variables:

| Environment | Example file               |
| ----------- | -------------------------- |
| Development | `.env.development.example` |
| Test        | `.env.test.example`        |
| Production  | `.env.production.example`  |

Copy the relevant example (for example, `cp .env.development.example .env.development`), adjust the values, and provide them to the process through your shell, process manager, or deployment platform. Real environment files are ignored by Git; only the `.example` files belong in the repository.

`NODE_ENV` identifies the target environment. `PORT` controls the listening port and defaults to `3000` when unset. Never place real secrets in the example files.

## Production concurrency

See [production concurrency guidance](./docs/concurrency.md) for container replicas, Node/PM2 process models, capacity planning, and graceful shutdown expectations. The development command remains `npm run start:dev`.

# 🚨 Error Responses

Errors are returned by the global HTTP exception filter in a consistent envelope:

```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Cannot GET /missing",
  "path": "/missing",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`statusCode` and `message` come from the thrown `HttpException`; unexpected errors are reported as a `500` with a generic message.

# 🌐 CORS

Cross-origin requests are enabled for local development by default. To restrict them, set `CORS_ORIGIN` to a comma-separated list of allowed origins, for example:

```bash
CORS_ORIGIN=https://app.stellaraid.example,https://admin.stellaraid.example
```

# 🛡 Security Headers

Every response carries security headers set by [Helmet](https://helmetjs.github.io/), with a strict Content Security Policy for JSON routes and a relaxed one, limited to what Swagger UI needs, for the docs pages. See [docs/security-headers.md](docs/security-headers.md) for the policies and how to change them.

# 🔌 API Endpoints

All API routes are served under the versioned `/api/v1` prefix.

- `GET /api/v1/` — returns the current greeting (`"Hello World!"`). It includes an `ETag` and `Cache-Control: public, max-age=60`; send its ETag as `If-None-Match` to receive `304 Not Modified` when unchanged.

See [error responses and validation](./docs/errors-and-validation.md) for machine-readable codes and clear validation message conventions.

- `GET /api/v1/admin/analytics` — reserved admin endpoint; returns `401` until
  authentication and authorization are implemented.
- `GET /api/v1/docs` — interactive Swagger UI; `/api/v1/docs-json` serves the
  generated OpenAPI document.
- `GET /api/v1/health/live` — liveness metadata: `status`, `service`, `version`, and `timestamp`.
- `GET /api/v1/health/ready` — readiness metadata plus named dependency check states.
- `GET /api/v1/version` — service name, version, and environment metadata.

# 📖 API Documentation

- [Client usage examples](./docs/api.md)
- [Inclusive API design guidelines](./docs/accessibility.md)
- [API deprecation and change policy](./docs/deprecation-policy.md)

API responses are JSON. JSON request bodies must use `Content-Type: application/json` (or another `+json` media type), and clients should send `Accept: application/json`. Unsupported write media types return `415`, and unsupported representations return `406` with the documented JSON error envelope.

## Admin and Media Scaffolds

The admin module is intentionally fail-closed: its guard denies every request
until real authentication and role-based authorization are connected. Before
enabling admin operations, require an authenticated principal with an explicit
admin role, enforce least privilege, and audit sensitive actions. The current
analytics operation is a placeholder and does not expose data.

The media module defines storage-provider and validation-hook interfaces for
future local, S3, or IPFS adapters. No upload route or storage provider is
configured. A provider and at least one validation hook (including size,
content-type, and content inspection) are required before the service accepts
uploads; never trust a client filename or write unvalidated content to storage.

## Database Commands

The Prisma schema is scaffolded at `prisma/schema.prisma`. Install the Prisma
CLI locally before using its commands:

```bash
npm install --save-dev prisma
DATABASE_URL="postgresql://user:password@localhost:5432/stellaraid" npm run db:migrate
DATABASE_URL="postgresql://user:password@localhost:5432/stellaraid" npm run db:seed
```

`db:migrate` runs `prisma migrate deploy`; `db:seed` runs the configured seed
entry point. Both commands fail with a clear message if `DATABASE_URL` or the
local Prisma CLI is missing. The seed entry point is a no-op until domain seed
data is defined. Configure a real database URL through the environment and
never commit credentials.

# 📦 Import Aliases

Source files can import from `src/` using the `@/*` alias instead of deep relative paths:

```ts
import { AppService } from '@/app.service';
```

The alias is declared in `tsconfig.json` and mapped for Jest in `package.json` and `test/jest-e2e.json`. Keep new imports consistent with this convention.

# ⚙️ Environment Variables

Supported environment variables are documented in [`.env.example`](./.env.example). Copy it to `.env` and adjust the values for your environment:

```bash
cp .env.example .env
```

`PORT` controls the port the API listens on and defaults to `3000` when unset. Only example values belong in `.env.example`; never commit real secrets.

# 🤝 Contributing

StellarAid is fully open-source and welcomes contributions from:

- Blockchain engineers
- Rust/Soroban developers
- Full-stack devs
- Designers & documentation writers
- Community moderators

See CONTRIBUTING.md for contribution workflow, code style, and development setup.

# 📜 License

StellarAid is released under the MIT License, allowing free use, modification, and distribution with attribution.

# 🌐 Join the StellarAid Journey

Together, we can expand access to transparent, borderless fundraising — empowering communities and creators worldwide.
