/**
 * Environment configuration.
 *
 * The single place that reads `process.env`. Values are parsed and validated
 * once at startup with Zod so a bad configuration fails fast with a clear
 * message instead of surfacing as a runtime surprise.
 */

import { z } from 'zod';

const DEFAULT_PORT = 3000;
const MIN_SECRET_LENGTH = 16;
const DEFAULT_ACCESS_TOKEN_TTL = '15m';
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 7;

const PORT_ERROR = 'PORT must be an integer between 0 and 65535.';

/** Circle's well-known USDC issuer on the Stellar public network. */
const DEFAULT_USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

/** Treat empty strings as "not provided" so `.env` keys can be left blank. */
function emptyToUndefined(value: unknown): unknown {
  return value === '' ? undefined : value;
}

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1)).optional();
const optionalUrl = z
  .preprocess(emptyToUndefined, z.string().url('must be a valid URL'))
  .optional();
const optionalPort = z
  .preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int()
      .min(1, 'must be a port between 1 and 65535.')
      .max(65535, 'must be a port between 1 and 65535.'),
  )
  .optional();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce
    .number({ error: PORT_ERROR })
    .int(PORT_ERROR)
    .min(0, PORT_ERROR)
    .max(65535, PORT_ERROR)
    .default(DEFAULT_PORT),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required (postgresql://user:pass@host:5432/db).'),
  REDIS_URL: optionalUrl.refine(
    (v) => v === undefined || v.startsWith('redis://') || v.startsWith('rediss://'),
    {
      error: 'REDIS_URL must use the redis:// or rediss:// scheme.',
    },
  ),
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required.' })
    .min(MIN_SECRET_LENGTH, `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`),
  JWT_REFRESH_SECRET: z
    .string({ error: 'JWT_REFRESH_SECRET is required.' })
    .min(MIN_SECRET_LENGTH, `JWT_REFRESH_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`),
  ACCESS_TOKEN_TTL: z.string().min(1).default(DEFAULT_ACCESS_TOKEN_TTL),
  REFRESH_TOKEN_TTL_DAYS: z.coerce
    .number()
    .int()
    .positive('REFRESH_TOKEN_TTL_DAYS must be a positive integer.')
    .default(DEFAULT_REFRESH_TOKEN_TTL_DAYS),
  S3_BUCKET: optionalString,
  S3_REGION: optionalString,
  STELLAR_NETWORK: z.enum(['testnet', 'public']).default('testnet'),
  USDC_ASSET_ISSUER: optionalString,
  EURC_ASSET_ISSUER: optionalString,
  NGNT_ASSET_ISSUER: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalPort,
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  CORS_ORIGIN: optionalString,
});

export type NodeEnv = 'development' | 'production' | 'test';

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly pass: string;
}

export interface AppEnv {
  readonly nodeEnv: NodeEnv;
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
  readonly isTest: boolean;
  readonly port: number;
  readonly databaseUrl: string;
  readonly redisUrl: string | undefined;
  readonly jwtSecret: string;
  readonly jwtRefreshSecret: string;
  /** JWT access-token lifetime, as accepted by `jsonwebtoken` (e.g. '15m'). */
  readonly accessTokenTtl: string;
  /** Refresh-token lifetime in days; stored hashed and revocable. */
  readonly refreshTokenTtlDays: number;
  readonly s3Bucket: string | undefined;
  readonly s3Region: string | undefined;
  readonly stellarNetwork: 'testnet' | 'public';
  /** Known issuer accounts for DEX price lookups. USDC defaults to Circle's
   * public-network issuer; EURC/NGNT have no safe default and are undefined
   * unless explicitly configured. */
  readonly priceAssetIssuers: {
    readonly USDC: string;
    readonly EURC: string | undefined;
    readonly NGNT: string | undefined;
  };
  /** Present only when SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS are all set. */
  readonly smtp: SmtpConfig | undefined;
  /** Comma-separated allowed CORS origins, or undefined to reflect the request origin. */
  readonly corsOrigins: string[] | undefined;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

function loadEnv(): AppEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${formatIssues(parsed.error)}`);
  }

  const raw = parsed.data;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = raw;
  const smtp: SmtpConfig | undefined =
    SMTP_HOST !== undefined &&
    SMTP_PORT !== undefined &&
    SMTP_USER !== undefined &&
    SMTP_PASS !== undefined
      ? { host: SMTP_HOST, port: SMTP_PORT, user: SMTP_USER, pass: SMTP_PASS }
      : undefined;

  return {
    nodeEnv: raw.NODE_ENV,
    isDevelopment: raw.NODE_ENV === 'development',
    isProduction: raw.NODE_ENV === 'production',
    isTest: raw.NODE_ENV === 'test',
    port: raw.PORT,
    databaseUrl: raw.DATABASE_URL,
    redisUrl: raw.REDIS_URL,
    jwtSecret: raw.JWT_SECRET,
    jwtRefreshSecret: raw.JWT_REFRESH_SECRET,
    accessTokenTtl: raw.ACCESS_TOKEN_TTL,
    refreshTokenTtlDays: raw.REFRESH_TOKEN_TTL_DAYS,
    s3Bucket: raw.S3_BUCKET,
    s3Region: raw.S3_REGION,
    stellarNetwork: raw.STELLAR_NETWORK,
    priceAssetIssuers: {
      USDC: raw.USDC_ASSET_ISSUER ?? DEFAULT_USDC_ISSUER,
      EURC: raw.EURC_ASSET_ISSUER,
      NGNT: raw.NGNT_ASSET_ISSUER,
    },
    smtp,
    corsOrigins: raw.CORS_ORIGIN
      ? raw.CORS_ORIGIN.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : undefined,
  };
}

export const env: AppEnv = loadEnv();
