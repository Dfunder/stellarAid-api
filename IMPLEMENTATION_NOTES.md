# Implementation: #832, #835, #836, #837

## Endpoints

- `GET /api/v1/users/:username/reviews?page&limit&sort=recent|highest|lowest`
- `POST /api/v1/reviews` (auth) — create review
- `POST /api/v1/reviews/:id/report` (auth) — report with reason/note, 5/day limit
- `POST /api/v1/threads` (auth) — create or return existing 1:1 thread

## Behavior

- Public list hides reviews with OPEN/REVIEWING reports
- Average rating + distribution cached (`reviews:avg:{targetId}`, 5m TTL)
- Author identity: name, username, avatar (null until profile avatars exist)
- Threads: one per user pair; idempotent return of existing

## Schema

- `ReviewReport.note` optional + index on `(reporterId, createdAt)`

## Tests

```bash
npx vitest run src/services/reviews.service.test.ts src/services/threads.service.test.ts
```
