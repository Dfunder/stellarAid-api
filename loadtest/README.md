# Marketplace load tests

`marketplace.js` is a [k6](https://k6.io) script covering the two endpoints
named in the "Marketplace performance tests" issue: browse
(`GET /api/v1/marketplace`) and search (`GET /api/v1/search`). It has not
been run against a live instance as part of this change — there's no
running server, database, or Redis in this environment — so treat it as a
ready-to-run test plan, not a verified performance report.

## Running it

```sh
# requires k6 installed (https://k6.io/docs/get-started/installation/) and
# a running instance of this API, migrated and seeded with some published
# artworks
k6 run --env BASE_URL=http://localhost:3000 loadtest/marketplace.js
```

or via the npm script: `npm run loadtest -- --env BASE_URL=http://localhost:3000`.

## What it checks

- `marketplace_browse`: 100 constant VUs against `/api/v1/marketplace` for
  2 minutes. Threshold: p95 latency < 500ms.
- `search`: 50 constant VUs against `/api/v1/search` for 2 minutes,
  starting after the browse scenario. Threshold: p95 latency < 1000ms.

k6 prints p50/p95/p99 for `http_req_duration` per scenario at the end of
the run, and exits non-zero if a threshold is breached. Memory-leak
detection isn't something k6 measures on its own — watch the API process's
RSS/heap (e.g. `node --inspect` + a heap snapshot, or your platform's
process metrics) alongside a run.

## Bottleneck mitigations already applied

- `marketplace.service.browseArtworks` caches results in Redis for 30s per
  unique filter/sort/cursor combination (cache-aside; degrades to a normal
  DB query when Redis isn't configured) — the load test's repeated queries
  across a small set of categories/sorts should see a high cache-hit rate.
- `Artwork` has indexes on `category`, `price`, and `(userId, published)`
  from the existing schema, plus the `price` index added in this change —
  the browse endpoint's filters all have index coverage.
- Search uses Postgres's built-in `to_tsvector`/`ts_rank`; a `GIN` index on
  the computed tsvector expression would be the next optimization if a
  real run shows search latency dominated by the ranking scan, but adding
  one wasn't justified without a measured baseline to compare against.
