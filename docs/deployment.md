# Production Deployment Guide

This guide provides comprehensive instructions for deploying **Lumora API** (stellarAid-api) in production environments, covering environment configuration, Docker containerization, database migrations, process management, and disaster recovery / rollback procedures.

---

## Table of Contents

1. [Architecture & Prerequisites](#1-architecture--prerequisites)
2. [Environment Configuration](#2-environment-configuration)
3. [Direct Deployment (PM2 / VM / Bare Metal)](#3-direct-deployment-pm2--vm--bare-metal)
4. [Docker Deployment](#4-docker-deployment)
5. [Database Migration Process](#5-database-migration-process)
6. [Rollback & Recovery Procedures](#6-rollback--recovery-procedures)
7. [Post-Deployment Verification & Monitoring](#7-post-deployment-verification--monitoring)

---

## 1. Architecture & Prerequisites

### Technology Stack
- **Runtime:** Node.js 20.x (LTS)
- **Framework:** NestJS 11.x
- **Database:** PostgreSQL 15+ (managed with Prisma ORM)
- **In-Memory Store / Rate Limiting:** Redis 7+
- **Blockchain:** Stellar Network (Horizon API & Soroban RPC)
- **Object Storage:** AWS S3 (or S3-compatible storage)
- **Email Service:** SendGrid

### Production Requirements
- **Hardware:** Minimum 2 vCPU, 2 GB RAM (4 GB recommended for production workloads).
- **Operating System:** Linux (Ubuntu 22.04 LTS, Debian 12, or Alpine Linux for containers).
- **Network Ports:** Port `3000` or `3001` (internal API port, bound behind reverse proxy or load balancer).
- **SSL / TLS:** HTTPS termination via Cloudflare, AWS ALB, Nginx, or Caddy.

---

## 2. Environment Configuration

All production configurations are provided via environment variables. The application strictly validates required variables upon boot (`src/config/env.validation.ts`). Missing or blank values will abort startup.

### Required Environment Variables

| Variable | Description | Example / Format |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | API listener port | `3001` (or `3000`) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@db-host:5432/stellaraid_prod?schema=public&sslmode=require` |
| `JWT_SECRET` | Secret key for signing access tokens | 64+ char random string |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | 64+ char random string |
| `REDIS_URL` | Redis connection URL | `redis://:password@redis-host:6379/0` |
| `REDIS_HOST` | Redis host (if using host/port fallback) | `redis-host` |
| `REDIS_PORT` | Redis port | `6379` |
| `STELLAR_NETWORK` | Stellar network target | `PUBLIC` (for mainnet) or `TESTNET` |
| `PLATFORM_WALLET_SECRET` | Platform Stellar wallet secret key (`S...`) | `SCZ...` (Keep confidential) |
| `ESCROW_CONTRACT_ID` | Soroban Escrow contract address (`C...`) | `CA...` |
| `SENDGRID_API_KEY` | SendGrid API key for transactional emails | `SG.xxxxxxxx...` |
| `AWS_S3_BUCKET` | S3 bucket name for uploads/portfolio assets | `lumora-media-production` |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key | `wJalrXUtnFEMI...` |
| `WALLET_ENCRYPTION_KEY` | 32-byte hex key for encrypting wallet seeds | 64-character hexadecimal string |
| `NEXT_PUBLIC_FRONTEND_URL` | Allowed CORS origin for web client | `https://lumora.art` |

### Key Generation Utilities

Generate cryptographically secure secrets prior to deployment:

```bash
# Generate JWT Secret
openssl rand -base64 48

# Generate JWT Refresh Secret
openssl rand -base64 48

# Generate WALLET_ENCRYPTION_KEY (32-byte / 64 hex characters)
openssl rand -hex 32
```

> [!CAUTION]
> Never commit `.env` or production secret keys to version control. Store secrets securely using AWS Secrets Manager, HashiCorp Vault, Doppler, or your cloud platform's secret management system.

---

## 3. Direct Deployment (PM2 / VM / Bare Metal)

When deploying directly to a Linux Virtual Machine (e.g. AWS EC2, DigitalOcean Droplet, Ubuntu Server):

### Step 1: Install System Dependencies

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# Install PM2 process manager globally
sudo npm install -g pm2
```

### Step 2: Clone and Build Application

```bash
# Clone the repository
git clone https://github.com/Dfunder/stellarAid-api.git /var/www/stellaraid-api
cd /var/www/stellaraid-api

# Install production and build dependencies
npm ci

# Configure environment file
cp .env.example .env
nano .env

# Generate Prisma Client and build the TypeScript application
npx prisma generate
npm run build
```

### Step 3: Run Database Migrations

```bash
# Apply pending Prisma migrations
npx prisma migrate deploy
```

### Step 4: Configure PM2 Process Manager

Create an `ecosystem.config.js` file in the project root:

```javascript
module.exports = {
  apps: [
    {
      name: 'stellaraid-api',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100,
      listen_timeout: 10000,
      kill_timeout: 5000,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
```

Start and persist the application:

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Generate and enable systemd startup script
pm2 startup systemd
```

### Step 5: Configure Nginx Reverse Proxy & SSL

Create `/etc/nginx/sites-available/stellaraid-api`:

```nginx
server {
    server_name api.lumora.art;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }
}
```

Enable the site and obtain an SSL certificate:

```bash
sudo ln -s /etc/nginx/sites-available/stellaraid-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Install Let's Encrypt SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.lumora.art
```

---

## 4. Docker Deployment

### Multi-Stage Dockerfile Overview

The repository provides a production-ready, multi-stage `Dockerfile`:
- **Stage 1 (builder):** Installs all dependencies, generates Prisma client artifacts, and compiles TypeScript into `dist/`.
- **Stage 2 (production):** Installs production dependencies only, copies compiled `dist/`, `prisma/`, and generated `@prisma/client`, resulting in a lean and secure container image running Alpine Linux.

### Option A: Standalone Docker Container

```bash
# 1. Build the production Docker image
docker build -t stellaraid-api:latest .

# 2. Run the container with environment variables
docker run -d \
  --name stellaraid-api \
  --restart unless-stopped \
  -p 3001:3001 \
  --env-file .env.production \
  stellaraid-api:latest
```

### Option B: Docker Compose (Full Stack Deployment)

For standalone servers running PostgreSQL, Redis, and API together:

1. Create a `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: stellaraid_api_prod
    ports:
      - '3001:3001'
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
      - PORT=3001
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
    healthcheck:
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:3001/v1/health']
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s

  db:
    image: postgres:15-alpine
    container_name: stellaraid_postgres_prod
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-stellaraid}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-stellaraid_db}
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-stellaraid} -d ${POSTGRES_DB:-stellaraid_db}']
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always

  redis:
    image: redis:7-alpine
    container_name: stellaraid_redis_prod
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data_prod:/data
    healthcheck:
      test: ['CMD', 'redis-cli', '-a', '${REDIS_PASSWORD}', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always

volumes:
  postgres_data_prod:
  redis_data_prod:
```

2. Deploy the stack:

```bash
# Build and start services in detached mode
docker compose -f docker-compose.prod.yml up -d --build

# Run database migrations inside the running API container
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Verify logs
docker compose -f docker-compose.prod.yml logs -f api
```

### Option C: Cloud Orchestration (AWS ECS / Kubernetes)

For container orchestration:
1. **Build and Tag Image:**
   ```bash
   docker build -t <registry-url>/stellaraid-api:<commit-sha> .
   docker push <registry-url>/stellaraid-api:<commit-sha>
   ```
2. **Pre-Deployment Migration Task:**
   Execute `npx prisma migrate deploy` as a one-off task (e.g. AWS ECS Task, Kubernetes Job, or GitHub Actions workflow step) before updating the service deployment.
3. **Rolling Updates:**
   Configure rolling update strategy with a health check path pointing to `/v1/health` to guarantee zero downtime.

---

## 5. Database Migration Process

The application uses **Prisma Migrate** to manage PostgreSQL database schemas.

### Migration Guidelines for Production

> [!IMPORTANT]
> **NEVER run `prisma migrate dev` or `prisma db push` in a production environment.**  
> - `prisma migrate dev` attempts to create new migration files and may prompt to reset the database.
> - `prisma db push` does not track migration history and may cause data loss.
> - Always use `npx prisma migrate deploy` in production.

### Standard Production Migration Workflow

1. **Check Migration Status:**
   ```bash
   npx prisma migrate status
   ```
   This command inspects the target database against the local migration files in `prisma/migrations` and reports pending migrations or schema drift.

2. **Apply Pending Migrations:**
   ```bash
   npx prisma migrate deploy
   ```
   This command applies all unapplied SQL migrations in `prisma/migrations/` in chronological order without prompting.

3. **Verify Database Health:**
   ```bash
   curl http://localhost:3001/v1/health
   ```

4. **Seed Database (Initial Deployment Only):**
   ```bash
   npx prisma db seed
   ```

### Zero-Downtime Migration Best Practices (Expand and Contract Pattern)

When introducing breaking schema changes:
1. **Phase 1 (Expand):** Add new columns/tables as nullable or with defaults. Deploy schema migration (`prisma migrate deploy`). Deploy code that writes to both old and new columns.
2. **Phase 2 (Migrate Data):** Run a background script to backfill data from old schema to new schema.
3. **Phase 3 (Contract):** Deploy code reading only from the new columns. Once verified, deploy a subsequent migration removing the old column/table.

---

## 6. Rollback & Recovery Procedures

### 6.1 Application Rollback

#### Direct / PM2 Deployment
```bash
# 1. Revert to previous git commit or release tag
cd /var/www/stellaraid-api
git checkout <previous-release-tag>

# 2. Re-install dependencies and build
npm ci
npx prisma generate
npm run build

# 3. Reload PM2 cluster with zero downtime
pm2 reload stellaraid-api
```

#### Docker Deployment
```bash
# 1. Update service image tag to previous stable version
docker compose -f docker-compose.prod.yml down api
docker run -d --name stellaraid-api-rollback ... stellaraid-api:<previous-tag>
# Or update image tag in your compose file and restart:
docker compose -f docker-compose.prod.yml up -d api
```

---

### 6.2 Database Rollback Strategy

Prisma does not provide automated "down" migrations. To revert a migration in production:

#### Approach A: Compensating Forward Migration (Recommended)
1. In development, generate a new migration that reverses the changes:
   ```bash
   npx prisma migrate dev --name revert_previous_change
   ```
2. Test thoroughly on staging.
3. Deploy the compensating migration to production:
   ```bash
   npx prisma migrate deploy
   ```

#### Approach B: Restoring from Automated Snapshot / Backup

If a catastrophic schema corruption occurs:

1. **Stop the API service to avoid further data writes:**
   ```bash
   pm2 stop stellaraid-api
   # or
   docker compose -f docker-compose.prod.yml stop api
   ```

2. **Restore PostgreSQL Database:**
   ```bash
   # Terminate existing connections
   psql -U stellaraid -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'stellaraid_db';"

   # Drop and recreate target database
   dropdb -U stellaraid stellaraid_db
   createdb -U stellaraid stellaraid_db

   # Restore from backup file
   pg_restore -U stellaraid -d stellaraid_db /path/to/backup_YYYYMMDD_HHMM.dump
   # Or for plain SQL backups:
   psql -U stellaraid -d stellaraid_db < /path/to/backup_YYYYMMDD_HHMM.sql
   ```

3. **Verify Prisma Migration Table:**
   ```bash
   npx prisma migrate status
   ```

4. **Restart API Service:**
   ```bash
   pm2 start stellaraid-api
   # or
   docker compose -f docker-compose.prod.yml start api
   ```

---

### 6.3 Redis Cache Invalidation

Following an application or database rollback, invalidate cached data in Redis to prevent serving obsolete or mismatched schemas:

```bash
# Connect to Redis CLI and flush cache database
redis-cli -h <redis-host> -p 6379 -a <redis-password> FLUSHDB
```

---

## 7. Post-Deployment Verification & Monitoring

### 1. Healthcheck Endpoint
Verify that the application and its dependencies (PostgreSQL and Redis) are functioning:

```bash
curl -i https://api.lumora.art/v1/health
```

**Expected Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-08-25T20:00:00.000Z",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

### 2. Swagger API Documentation
Verify that documentation is accessible (if enabled in staging/production):
```
https://api.lumora.art/api/docs
```

### 3. Log Monitoring
Monitor real-time Winston production JSON logs:
```bash
# For PM2
pm2 logs stellaraid-api --json

# For Docker
docker compose -f docker-compose.prod.yml logs -f --tail=100 api
```
