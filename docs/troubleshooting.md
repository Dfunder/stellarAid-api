# Troubleshooting Guide

This guide provides diagnostic steps, root cause analysis, and resolution strategies for common operational, database, cache, and blockchain issues encountered when running **Lumora API** (stellarAid-api).

---

## Table of Contents

1. [Quick Diagnostic Checklist](#1-quick-diagnostic-checklist)
2. [Common Startup Issues](#2-common-startup-issues)
3. [Database Connection & Prisma Troubleshooting](#3-database-connection--prisma-troubleshooting)
4. [Redis & Throttling Debugging](#4-redis--throttling-debugging)
5. [Stellar & Soroban Blockchain Issues](#5-stellar--soroban-blockchain-issues)
6. [Logging & Diagnostics](#6-logging--diagnostics)

---

## 1. Quick Diagnostic Checklist

When experiencing issues, run through these quick diagnostic steps:

```bash
# 1. Check API health endpoint (verifies DB + Redis)
curl -i http://localhost:3001/v1/health

# 2. Inspect Docker container status and logs
docker compose ps
docker compose logs --tail=100 -f api

# 3. Test PostgreSQL connectivity
docker compose exec db pg_isready -U stellaraid -d stellaraid_db

# 4. Test Redis connectivity
docker compose exec redis redis-cli ping

# 5. Check migration status
npx prisma migrate status
```

---

## 2. Common Startup Issues

### 2.1 "Missing required environment variables" Error

#### Symptom
```text
Error: Missing required environment variables: JWT_SECRET, WALLET_ENCRYPTION_KEY
    at validate (/usr/src/app/dist/config/env.validation.js:23:15)
```

#### Cause
The environment validation hook (`src/config/env.validation.ts`) validates that all critical environment keys are present and non-empty on boot.

#### Solution
1. Ensure your `.env` file exists in the project root.
2. Verify that all 13 required variables are populated:
   ```bash
   DATABASE_URL=postgresql://stellaraid:stellaraid_pass@localhost:5432/stellaraid_db?schema=public
   JWT_SECRET=your-64-character-jwt-secret-key-here
   JWT_REFRESH_SECRET=your-64-character-refresh-secret-key-here
   REDIS_URL=redis://localhost:6379
   REDIS_HOST=localhost
   REDIS_PORT=6379
   STELLAR_NETWORK=TESTNET
   PLATFORM_WALLET_SECRET=SCZ...
   ESCROW_CONTRACT_ID=CA...
   SENDGRID_API_KEY=SG...
   AWS_S3_BUCKET=lumora-media
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   WALLET_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   ```
3. Generate missing cryptographic keys using:
   ```bash
   openssl rand -hex 32
   ```

---

### 2.2 Port Conflict (`EADDRINUSE`)

#### Symptom
```text
Error: listen EADDRINUSE: address already in use :::3001
```

#### Cause
Another process or a previous instance of the API is already listening on port `3001` (or `3000`).

#### Solution
- **On Linux / macOS:**
  ```bash
  # Find PID occupying the port
  lsof -i :3001
  # Kill the process
  kill -9 <PID>
  ```
- **On Windows (PowerShell):**
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force
  ```
- **Change Application Port:** Set `PORT=3002` in your `.env` file.

---

### 2.3 Prisma Client Not Generated / Module Missing

#### Symptom
```text
Error: @prisma/client did not initialize yet. Please run "prisma generate" and try again.
# or
Cannot find module '@prisma/client'
```

#### Cause
The Prisma Client artifacts have not been generated for the current platform/runtime, or `node_modules/@prisma/client` was not built.

#### Solution
```bash
# Generate Prisma client
npx prisma generate

# If building Docker image, ensure Dockerfile includes:
# RUN npx prisma generate
```

---

### 2.4 Bcrypt Native Module Compilation Errors

#### Symptom
```text
Error: /usr/src/app/node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node: invalid ELF header
```

#### Cause
`node_modules` was built on a host OS (e.g. macOS or Windows) and mounted into a Linux container, causing binary ABI mismatch.

#### Solution
1. Avoid mounting host `node_modules` into container:
   ```yaml
   volumes:
     - .:/usr/src/app
     - /usr/src/app/node_modules # Anonymous volume preserves container node_modules
   ```
2. In native setups, rebuild native dependencies:
   ```bash
   npm rebuild bcrypt --build-from-source
   ```

---

### 2.5 CORS Errors on Client Requests

#### Symptom
```text
Access to fetch at 'http://localhost:3001/v1/auth/login' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

#### Cause
`NEXT_PUBLIC_FRONTEND_URL` in `.env` does not match the origin making the request.

#### Solution
Update `NEXT_PUBLIC_FRONTEND_URL` in `.env`:
```env
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```
For multiple origins or wildcards during local testing, verify the CORS configuration in `src/main.ts`.

---

## 3. Database Connection & Prisma Troubleshooting

### 3.1 Connection Refused (`ECONNREFUSED`)

#### Symptom
```text
Can't reach database server at `localhost`:`5432`
Please make sure your database server is running at `localhost`:`5432`.
```

#### Cause
- PostgreSQL is not running.
- Incorrect host name when running inside Docker containers (`localhost` instead of `db`).

#### Solution
- **If running with Docker Compose:**
  The `DATABASE_URL` inside the `api` container must use service name `db`:
  ```env
  DATABASE_URL=postgresql://stellaraid:stellaraid_pass@db:5432/stellaraid_db?schema=public
  ```
- **If running API on Host connecting to Docker DB:**
  Use `localhost` or `127.0.0.1`:
  ```env
  DATABASE_URL=postgresql://stellaraid:stellaraid_pass@localhost:5432/stellaraid_db?schema=public
  ```
- **Verify PostgreSQL container status:**
  ```bash
  docker compose ps db
  docker compose logs db
  ```

---

### 3.2 "Table does not exist" / Schema Out of Sync (`P2021`)

#### Symptom
```text
Invalid `this.prismaService.user.findUnique()` invocation:
The table `public.User` does not exist in the current database.
```

#### Cause
Database migrations have not been applied to the target database.

#### Solution
```bash
# In production / staging:
npx prisma migrate deploy

# In local development:
npx prisma migrate dev
```

---

### 3.3 Connection Pool Timeout (`P2024`)

#### Symptom
```text
Timed out fetching a new connection from the connection pool.
(More info: http://pris.ly/d/connection-pool-timeout)
```

#### Cause
Prisma client exhausted available database connections under high concurrent load or due to long-running unindexed queries.

#### Solution
1. **Increase Connection Pool Size:** Append `connection_limit` and `pool_timeout` parameters to `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&connection_limit=20&pool_timeout=30"
   ```
2. **Increase PostgreSQL `max_connections`:**
   ```sql
   ALTER SYSTEM SET max_connections = '200';
   ```
3. Use a connection pooler such as **PgBouncer** or **AWS RDS Proxy** in production environments.

---

### 3.4 SSL Connection Errors with Cloud Providers (AWS RDS, Supabase, Neon)

#### Symptom
```text
Error: pg_hba.conf rejects connection for host "...", user "...", database "...", no encryption
# or
SSL SYSCALL error: EOF detected
```

#### Cause
Managed PostgreSQL providers require SSL/TLS encrypted connections.

#### Solution
Append `sslmode=require` (or `sslmode=prefer`) to `DATABASE_URL`:
```env
DATABASE_URL="postgresql://user:password@aws-rds-endpoint.com:5432/lumora_db?schema=public&sslmode=require"
```

---

## 4. Redis & Throttling Debugging

### 4.1 "Redis connection failed" Error

#### Symptom
```text
[Nest] ERROR [RedisClient] Redis connection failed: Error: connect ECONNREFUSED 127.0.0.1:6379
```

#### Cause
- Redis service is down or unreachable.
- `REDIS_HOST` / `REDIS_PORT` is set to `localhost` inside a Docker container where it should be `redis`.

#### Solution
1. **Verify Redis Container Health:**
   ```bash
   docker compose ps redis
   docker compose exec redis redis-cli ping
   # Expected output: PONG
   ```
2. **Check Environment Variables:**
   - Inside Docker Compose: `REDIS_HOST=redis`, `REDIS_PORT=6379`
   - Local standalone: `REDIS_HOST=localhost`, `REDIS_PORT=6379`
3. **If Redis requires authentication:**
   Ensure `REDIS_URL` or password parameter is supplied:
   ```env
   REDIS_URL=redis://:your_strong_password@redis:6379/0
   ```

---

### 4.2 Throttler Rate Limiting Blocking Requests (HTTP 429 Too Many Requests)

#### Symptom
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

#### Cause
Client exceeded the rate limit configured in `src/app.module.ts` (default: 100 requests per 60 seconds per user/IP) or endpoint-specific `@Throttle` decorator limits.

#### Debugging & Resolution
1. Inspect rate-limiting keys stored in Redis:
   ```bash
   redis-cli -h localhost -p 6379 KEYS "throttler:*"
   ```
2. Reset rate limit for a specific IP/user:
   ```bash
   redis-cli -h localhost -p 6379 DEL "throttler:<key>"
   ```
3. To adjust limits globally, modify `ThrottlerModule` config in `src/app.module.ts`:
   ```typescript
   throttlers: [{ ttl: 60000, limit: 200 }], // Increase limit to 200 req / min
   ```

---

### 4.3 Redis Out of Memory (`OOM command not allowed`)

#### Symptom
```text
OOM command not allowed when used memory > 'maxmemory'.
```

#### Cause
Redis instance reached memory ceiling without an eviction policy configured for cache/throttler keys.

#### Solution
Configure Redis eviction policy in `redis.conf` or command line:
```bash
redis-cli CONFIG SET maxmemory 512mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## 5. Stellar & Soroban Blockchain Issues

### 5.1 Stellar Network Passphrase Mismatch (`tx_BAD_AUTH`)

#### Symptom
```text
Transaction failed with error: tx_BAD_AUTH
# or
Invalid signature / Bad public key
```

#### Cause
`STELLAR_NETWORK` is set to `TESTNET` while attempting to interact with mainnet accounts, or vice-versa. The transaction signature is rejected because the transaction was hashed with a different network passphrase.

#### Solution
Verify `STELLAR_NETWORK` in `.env`:
- **For Testing / Development:**
  ```env
  STELLAR_NETWORK=TESTNET
  ```
  Passphrase: `Test SDF Network ; September 2015`  
  Horizon: `https://horizon-testnet.stellar.org`  
  Soroban RPC: `https://soroban-testnet.stellar.org`
- **For Production:**
  ```env
  STELLAR_NETWORK=PUBLIC
  ```
  Passphrase: `Public Global Stellar Network ; September 2015`  
  Horizon: `https://horizon.stellar.org`  
  Soroban RPC: `https://soroban-futurenet.stellar.org` (or production RPC provider)

---

### 5.2 Invalid Platform Wallet Secret Key

#### Symptom
```text
Error: Invalid secret key
    at Keypair.fromSecret (stellar-sdk/lib/keypair.js:...)
```

#### Cause
`PLATFORM_WALLET_SECRET` in `.env` is either missing, has invalid length, or does not start with `S`.

#### Solution
- Ensure the secret starts with `S`, contains 56 base32 characters, and is a valid Ed25519 secret seed:
  ```env
  PLATFORM_WALLET_SECRET=SD...
  ```
- Generate a new testnet keypair via Stellar Laboratory or Stellar SDK:
  ```javascript
  const Keypair = require('@stellar/stellar-sdk').Keypair;
  const pair = Keypair.random();
  console.log('Public:', pair.publicKey());
  console.log('Secret:', pair.secret());
  ```

---

### 5.3 Account Not Found on Ledger (`404 Resource Missing` / `op_UNDERFUNDED`)

#### Symptom
```text
NotFoundError: https://horizon-testnet.stellar.org/accounts/G... - 404 Not Found
```

#### Cause
A Stellar account address was generated, but it has not been funded with the minimum reserve (1 XLM on testnet/public) to exist on the ledger.

#### Solution
- **On Testnet:** Fund the account using Stellar Friendbot:
  ```bash
  curl "https://friendbot.stellar.org?addr=<PUBLIC_KEY>"
  ```
- **On Public Network:** Send at least 2 XLM to the account from an exchange or existing funded wallet.

---

### 5.4 Soroban Escrow Contract Errors (`HostError` / `Contract Not Found`)

#### Symptom
```text
HostError: Error(Contract, #1)
# or
Contract CA... not found on network
```

#### Cause
1. `ESCROW_CONTRACT_ID` in `.env` is not deployed to the current network (`STELLAR_NETWORK`).
2. The contract function call reverted due to contract assertion failure (e.g. caller is not authorized, escrow already released or refunded, invalid amount).
3. Contract WASM instance expired (requires Soroban data entry TTL extension).

#### Solution
1. Verify contract ID format (starts with `C`, 56 characters).
2. Check Soroban explorer / RPC to confirm contract existence:
   ```bash
   curl -X POST https://soroban-testnet.stellar.org \
     -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"getLedgerEntries","params":{"keys":["..."]}}'
   ```
3. Inspect `StellarService` method parameters in `src/payments/stellar.service.ts` to ensure arguments (`clientPublicKey`, `artistPublicKey`, `amount`, `assetCode`, `commissionId`) match expected contract types (`ScVal`).

---

### 5.5 Transaction Sequence Number Mismatch (`tx_BAD_SEQ`)

#### Symptom
```text
tx_BAD_SEQ: The sequence number on the transaction does not match the account sequence number.
```

#### Cause
Multiple concurrent transactions were submitted from `PLATFORM_WALLET_SECRET` simultaneously without incrementing the sequence number correctly.

#### Solution
- Reload the source account sequence number immediately before signing:
  ```typescript
  const sourceAccount = await this.server.loadAccount(this.platformKeypair.publicKey());
  ```
- Use a Redis-backed distributed lock or queue (BullMQ) to serialize transactions originating from the platform wallet.

---

### 5.6 Insufficient Transaction Fee / Low Reserve (`tx_INSUFFICIENT_FEE` / `op_LOW_RESERVE`)

#### Symptom
```text
tx_INSUFFICIENT_FEE: Fee is below the minimum required network fee.
# or
op_LOW_RESERVE: Account balance is below the required minimum reserve.
```

#### Cause
- Surge pricing on Stellar network exceeded `BASE_FEE` (100 stroops).
- The source account does not hold enough native XLM to satisfy the minimum base reserve (0.5 XLM per trustline/signer/subentry + base reserve).

#### Solution
- Ensure the platform wallet maintains a minimum balance of 50–100 XLM for fees and reserves.
- In `src/payments/stellar.service.ts`, adjust dynamic fee bidding if network surge pricing occurs.

---

## 6. Logging & Diagnostics

### Viewing Real-time Winston Logs

The API uses structured Winston logging. In production, logs are formatted as JSON streams for easy ingestion by log aggregators (Datadog, Grafana Loki, CloudWatch).

```bash
# Tail Docker logs
docker compose logs -f --tail=100 api

# Filter for errors only
docker compose logs api | grep "error"

# Inspect structured JSON log output
docker compose logs api | jq .
```

### Inspecting Database Health Directly

```bash
# Run raw query test using Docker container
docker compose exec db psql -U stellaraid -d stellaraid_db -c "SELECT count(*) FROM \"User\";"
```
