import type { LogLevel } from '@nestjs/common';

const ORDER: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

/**
 * #1099: map LOG_LEVEL (error|warn|log|debug|verbose) to Nest logger levels.
 * Usage: NestFactory.create(AppModule, { logger: getLogLevels() })
 * Defaults to 'log' in production and 'debug' otherwise.
 */
export function getLogLevels(env: NodeJS.ProcessEnv = process.env): LogLevel[] {
  const fallback: LogLevel = env.NODE_ENV === 'production' ? 'log' : 'debug';
  const wanted = (env.LOG_LEVEL ?? fallback).toLowerCase() as LogLevel;
  const idx = ORDER.includes(wanted) ? ORDER.indexOf(wanted) : ORDER.indexOf(fallback);
  return ORDER.slice(0, idx + 1);
}
