# Audit Logging for Sensitive Actions

Sensitive operations (payments, wallet and admin actions, auth events) are
recorded to an immutable audit trail via the `audit` module. The set of audited
operations is enumerated in `src/audit/audit-actions.enum.ts` (`AuditAction`).

## What is recorded

Every audit entry captures:

- **who** — the acting user id (and role where relevant)
- **when** — a server timestamp
- **what** — the `AuditAction` and structured `details` (ids, amounts, target)
- **where** — request metadata (IP, correlation id)

## Immutability

- Audit records are **append-only**: the service exposes create/read only, never
  update or delete.
- In production, the database role used by the app should have `INSERT`/`SELECT`
  on the audit table but not `UPDATE`/`DELETE`, so records are tamper-evident.

## Viewing

- Admins can browse the trail through the admin endpoints
  (`GET /admin/audit-logs`) with filtering by user, action and date range.

## Adding a new audited action

1. Add a value to the `AuditAction` enum.
2. Call the audit service from the relevant service method with the action and
   its details.
