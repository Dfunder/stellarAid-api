# Container and startup performance

## Docker build

The Dockerfile uses separate dependency, build, and runtime stages. The runtime stage contains production dependencies and compiled `dist` output only, runs as an unprivileged `stellaraid` user, and uses `tini` for process reaping and signal forwarding.

Build and inspect the image locally:

```bash
docker build -t stellaraid-api:local .
docker image inspect stellaraid-api:local --format '{{.Size}}'
docker run --rm -p 3000:3000 stellaraid-api:local
```

The `.dockerignore` excludes dependencies, build output, Git metadata, environment files, Markdown, and compose files from the build context.

## Startup measurement

Normal startup is unchanged. To print an opt-in readiness duration:

```bash
STARTUP_TIMING=true npm run start:prod
```

The line is emitted after `app.listen()` succeeds and has this form:

```text
Startup ready in 123ms
```

For a shell-visible process baseline, use:

```bash
/usr/bin/time -f 'elapsed=%e s  maxrss=%M KB' env STARTUP_TIMING=true npm run start:prod
```

Stop it with `Ctrl+C`. Repeat at least three times after a warm dependency cache and record elapsed time plus image size. On this environment, a reproducible baseline can be recorded by running the build and startup commands on the same machine and Node version.

Initial implementation baseline should be captured per environment rather than treated as a universal number. Record Node.js version, CPU, OS, container mode, build duration, image size, and startup duration in release notes.

## Request payload limits

JSON and URL-encoded request bodies default to `1mb`. Override them separately
with `JSON_BODY_LIMIT` and `URLENCODED_BODY_LIMIT`, using byte values such as
`512kb`, `1mb`, or `1048576`. Requests over the configured limit return HTTP 413
(`Payload Too Large`). Keep limits close to the largest legitimate request;
raising them increases the memory available to a single request.

## Database query performance

The Prisma schema is a scaffold. Add an index only for a documented filter,
sort, join, or uniqueness requirement, and verify its benefit with the query
plan on representative data. Avoid indexing every column because indexes add
write and storage cost. `Campaign.createdAt` demonstrates an index for a common
time-ordered listing, while the commented compound example shows the expected
shape for a future status query.

The optional `attachPrismaQueryLogging` helper in
`src/common/db/prisma-query-logging.ts` logs queries at or above 250 ms when
`PRISMA_QUERY_LOGGING=true`. Set `PRISMA_SLOW_QUERY_MS` to change the threshold.
Attach it when constructing a future `PrismaService`; it is not enabled by
default and does not expose query parameters in logs.

## Performance smoke test

Start the API, then run the optional lightweight baseline script:

```bash
npm run perf:smoke -- --url=http://127.0.0.1:3000/api/v1 --requests=20
```

It reports successful responses, average/minimum/maximum latency, and aggregate
throughput. The script uses Node's built-in HTTP client, runs requests in
parallel, and exits non-zero if any request fails. It is intentionally not part
of the default test suite or CI gate.

See [module architecture](./module-architecture.md) for guidance on keeping
feature boundaries small and when to consider Nest lazy loading.
