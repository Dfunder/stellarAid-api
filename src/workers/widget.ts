/**
 * Structured logging.
 *
 * Wraps pino so call sites keep the `logger.info(message, context)` shape
 * while benefiting from pino's JSON output, levels and redaction. The raw
 * pino instance is exported for middleware (pino-http) that needs it.
 *
 * Redaction removes passwords, tokens and authorization headers from every
 * log line; the level is environment-aware (debug in development, info in
 * production).
 */

import { pino, type Logger } from 'pino';
import { env } from '@/config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  readonly [key: string]: unknown;
}

const REDACT_PATHS = [
  'password',
  '*.password',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'passwordHash',
  '*.passwordHash',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
];

export const baseLogger: Logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  base: { service: 'lumora-services' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

function write(level: LogLevel, message: string, context?: LogContext): void {
  baseLogger[level](context ?? {}, message);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};
