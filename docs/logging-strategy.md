# Logging Strategy

Structured logging is provided by `AppLoggerService`
(`src/common/logging/app-logger.service.ts`).

## Principles

- **Structured (JSON) output** so logs are machine-parseable and shippable to a
  log aggregator.
- **Log levels** — `debug`, `verbose`, `info`, `warn`, `error`. Use `debug`
  liberally in development; keep `info`+ meaningful in production.
- **Per-module context** — call `setContext('PaymentsService')` so each log line
  carries the emitting component.
- **Correlation IDs** — set a per-request correlation id
  (`setCorrelationId(...)`) so all log lines for one request can be traced.

## Usage

```ts
constructor(private readonly logger: AppLoggerService) {
  this.logger.setContext(PaymentsService.name);
}

this.logger.log('Escrow created', /* context */ undefined);
this.logger.error('Payment failed', err.stack);
```

## Notes

- Never log secrets, tokens or full card/wallet credentials.
- The service is `TRANSIENT`-scoped so each injecting class gets its own
  context.
