# Production concurrency and shutdown

The development workflow remains a single Node.js process:

```bash
npm run start:dev
```

For production, use one process model consistently rather than combining options.

## Container replicas

Run multiple replicas behind a load balancer. Example:

```yaml
services:
  api:
    build: .
    ports:
      - '3000:3000'
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
```

Keep PostgreSQL and Redis shared across replicas. Store no required process-local state (sessions or locks) without an external adapter.

## Node cluster

If not using container orchestration, Node's cluster mode or PM2 can distribute traffic across CPU cores:

```bash
pm2 start dist/main.js --name stellaraid-api -i max
```

Use the PM2 ecosystem file or platform configuration to set the replica count; do not use `node dist/main` with cluster enabled in more than one process manager.

## Container and platform runtime

A container platform should perform rolling restarts, health checks, and a fixed graceful termination timeout. Route traffic only to a replica after it has initialized PostgreSQL, Redis, or other required dependencies.

## Graceful shutdown

Production processes should:

- stop accepting new work before termination;
- stop timers and background workers;
- close database, Redis, and HTTP resources;
- allow in-flight requests to finish before forced exit.

Nest applications can enable shutdown hooks and add `app.enableShutdownHooks()` in `main.ts` when these lifecycle integrations are implemented. Until then, platforms should send `SIGTERM`, allow enough time for active requests to finish, and restart replicas one at a time.

## Capacity

Do not infer concurrency from CPU count alone. Measure memory, database pool limits, Redis capacity, downstream latency, and request payload limits under realistic load. Configure each runtime replica within database connection limits.
