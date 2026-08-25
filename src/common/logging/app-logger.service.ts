import { Injectable, LoggerService, Scope } from '@nestjs/common';

/**
 * Thin structured-logging wrapper around NestJS's logger.
 *
 * Emits JSON log lines with a level, message, optional context and an optional
 * correlation id so logs can be traced across a single request. Inject this in
 * modules instead of using `console.*`. See `docs/logging-strategy.md`.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private context?: string;
  private correlationId?: string;

  setContext(context: string): this {
    this.context = context;
    return this;
  }

  setCorrelationId(correlationId: string): this {
    this.correlationId = correlationId;
    return this;
  }

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(
    level: string,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const entry = {
      level,
      time: new Date().toISOString(),
      context: context ?? this.context,
      correlationId: this.correlationId,
      message,
      ...(trace ? { trace } : {}),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }
}
