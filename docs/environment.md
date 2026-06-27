# Environment Variables

Copy `.env.example` to `.env` for local development, then replace placeholder values with environment-specific settings. Required variables must be set for a fully functional deployment. Optional variables either have safe local defaults or enable integrations only when configured.

## Application

| Variable | Required | Purpose | Default / example |
| --- | --- | --- | --- |
| `NODE_ENV` | Optional | Runtime mode. Non-production mode also exposes the Bull queue dashboard. | `development` |
| `PORT` | Optional | HTTP port used by the NestJS API. | `3000` |
| `ENABLE_SWAGGER` | Optional | Reserved local configuration flag. Swagger is currently mounted by the app regardless of this value. | `true` |
| `FRONTEND_URL` | Optional | Allowed CORS origin for browser clients. Set this to the deployed frontend URL outside local development. | `http://localhost:3000` |
| `JSON_BODY_LIMIT` | Optional | Maximum JSON request body size accepted by Express. | `1mb` |
| `FILE_UPLOAD_LIMIT` | Optional | Maximum URL-encoded request body size accepted by Express. | `5mb` |

## Database

| Variable | Required | Purpose | Default / example |
| --- | --- | --- | --- |
| `DATABASE_URL` | Required | PostgreSQL connection string used by Prisma migrations and runtime database access. | `postgresql://postgres:postgres@localhost:5432/stellaraid?schema=public` |
| `POSTGRES_USER` | Optional | Docker Compose PostgreSQL username for the local `postgres` service. | `stellaraid` |
| `POSTGRES_PASSWORD` | Optional | Docker Compose PostgreSQL password for the local `postgres` service. | `stellaraid` |
| `POSTGRES_DB` | Optional | Docker Compose PostgreSQL database name for the local `postgres` service. | `stellaraid` |

`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` configure only the Compose-managed database container. Keep `DATABASE_URL` in sync with those values when using Docker Compose locally.

## Redis

| Variable | Required | Purpose | Default / example |
| --- | --- | --- | --- |
| `REDIS_URL` | Required | Redis connection string used by Bull queues, cache, throttling, and Redis health checks. | `redis://localhost:6379` |

## Authentication And Admin Access

| Variable | Required | Purpose | Default / example |
| --- | --- | --- | --- |
| `JWT_SECRET` | Required | Secret used to sign and verify JWT access tokens. Use a long random value in shared environments. | `change-me-in-production` |
| `ADMIN_WALLETS` | Optional | Comma-separated Stellar public keys that receive the `ADMIN` role after wallet authentication. | empty |
| `ADMIN_EMAILS` | Optional | Comma-separated email addresses that receive the daily admin summary email. | empty |

## Email

| Variable | Required | Purpose | Default / example |
| --- | --- | --- | --- |
| `SMTP_HOST` | Optional | SMTP server host. Real email sending is enabled only when host, user, and password are all set. | empty |
| `SMTP_PORT` | Optional | SMTP server port. Port `465` is treated as secure SMTP. | `587` |
| `SMTP_USER` | Optional | SMTP username. | empty |
| `SMTP_PASS` | Optional | SMTP password. | empty |
| `EMAIL_FROM` | Optional | Sender address used for outgoing transactional emails. | `noreply@stellaraid.io` |
| `APP_BASE_URL` | Optional | Public backend or app URL used when generating email preference links. | `http://localhost:3000` |

Without complete SMTP credentials, the email service uses a JSON transport suitable for local development.

## Stellar

| Variable | Required | Purpose | Default / example |
| --- | --- | --- | --- |
| `STELLAR_HORIZON_URL` | Optional | Stellar Horizon endpoint used for account, transaction, operation, and health checks. | `https://horizon-testnet.stellar.org` |
| `STELLAR_RPC_URL` | Optional | Soroban RPC endpoint used for smart contract simulation and invocation. | `https://soroban-testnet.stellar.org:443` |
| `STELLAR_NETWORK_PASSPHRASE` | Optional | Stellar network passphrase used when building Soroban transactions. | `Test SDF Network ; September 2015` |
| `STELLAR_SERVER_SECRET` | Optional | Stellar secret key used by the server to sign Soroban contract invocations when a caller does not provide a signer. | empty |
| `STELLAR_FEE_BUMP_SECRET` | Optional | Stellar secret key used to wrap Soroban transactions in fee-bump transactions. | empty |

Set the Horizon URL, RPC URL, and network passphrase together when moving between testnet, mainnet, or custom networks.

## Cloudinary

| Variable | Required | Purpose | Default / example |
| --- | --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Optional | Cloudinary cloud name used for image uploads and signed upload URLs. Required for upload features. | empty |
| `CLOUDINARY_API_KEY` | Optional | Cloudinary API key used for uploads and signed upload URLs. Required for upload features. | empty |
| `CLOUDINARY_API_SECRET` | Optional | Cloudinary API secret used for uploads and signed upload URL generation. Required for upload features. | empty |
| `CLOUDINARY_UPLOAD_PRESET` | Optional | Upload preset included in signed upload requests. | `stellaraid-upload` |

## Secrets Management

Do not commit real `.env` files, production credentials, private keys, SMTP passwords, Cloudinary secrets, database passwords, or JWT secrets.

Use a managed secret store for deployed environments, such as your cloud provider's secret manager, Kubernetes Secrets sealed with your cluster tooling, or your hosting platform's encrypted environment variable store. Rotate `JWT_SECRET`, `SMTP_PASS`, `CLOUDINARY_API_SECRET`, `STELLAR_SERVER_SECRET`, `STELLAR_FEE_BUMP_SECRET`, and database credentials if they are exposed.

Keep local examples realistic but non-sensitive. `.env.example` should document names, formats, and safe development defaults only.
