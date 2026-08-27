import type { CompressionOptions } from 'compression';

/** Resolved compression configuration for the current environment. */
export interface CompressionSettings {
  enabled: boolean;
  options: CompressionOptions;
}

/** Default zlib level per environment (0-9, higher = smaller/slower). */
const LEVEL_BY_ENVIRONMENT: Record<string, number> = {
  production: 6,
  development: 1,
  test: 0,
};

const DEFAULT_THRESHOLD_BYTES = 1024;

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

function parseIntOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Builds the response-compression settings for an environment.
 *
 * Defaults: enabled everywhere except tests; production favors ratio
 * (level 6), development favors latency (level 1). Every knob can be
 * overridden through environment variables:
 * - `COMPRESSION_ENABLED`   true/false toggle
 * - `COMPRESSION_LEVEL`     zlib level 0-9
 * - `COMPRESSION_THRESHOLD` minimum response size in bytes to compress
 */
export function getCompressionSettings(
  env: NodeJS.ProcessEnv = process.env,
): CompressionSettings {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const enabled = parseBool(env.COMPRESSION_ENABLED, nodeEnv !== 'test');
  const level = Math.min(
    9,
    Math.max(0, parseIntOr(env.COMPRESSION_LEVEL, LEVEL_BY_ENVIRONMENT[nodeEnv] ?? 6)),
  );
  const threshold = Math.max(
    0,
    parseIntOr(env.COMPRESSION_THRESHOLD, DEFAULT_THRESHOLD_BYTES),
  );

  return { enabled, options: { level, threshold } };
}
