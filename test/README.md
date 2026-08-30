# Test Data Seeding

This directory contains tools for seeding the database with test data.

## Usage

To seed the database, run the following command:

```
npm run seed
```

This will drop all existing data and populate the database with a fresh set of test data.

## Creating New Factories

To create a new factory, add a new file to the `test/factories` directory. The file should export a function that creates and saves a new model instance.

## Cleaning Up Data

The `cleanup` function in `test/test-utils.ts` can be used to delete all data from the database. This is useful for ensuring a clean state between test runs.

## E2E Tests

The E2E suites boot the full application with a real Passport `jwt` strategy,
URI versioning, validation pipe and response envelope. Stellar on-chain calls
and rate limiting are faked so tests never touch Horizon / Soroban or hit
throttle limits.

To run them:

```
npm run test:e2e
```

Suites:

- `user-workflow.e2e-spec.ts` — registration, login gating, wallet connect, profile.
- `commission-workflow.e2e-spec.ts` — full commission lifecycle + role enforcement.
- `payment-workflow.e2e-spec.ts` — escrow initiation, confirm, release, notifications.
- `marketplace-search.e2e-spec.ts` — search, filters, sorting, pagination.

Shared setup lives in `test/helpers/e2e-test-app.ts` (`createTestApp`). Each
suite boots its own app and starts from a clean database via `cleanup`.
