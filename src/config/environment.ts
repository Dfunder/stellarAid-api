import { z } from 'zod';

const PORT_MESSAGE = 'PORT must be an integer between 1 and 65535.';

const portSchema = z.coerce
  .number({ error: PORT_MESSAGE })
  .int(PORT_MESSAGE)
  .min(1, PORT_MESSAGE)
  .max(65535, PORT_MESSAGE)
  .default(3000);

const corsOriginSchema = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .superRefine((origins, ctx) => {
    origins.forEach((origin, index) => {
      let parsed: URL;

      try {
        parsed = new URL(origin);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: 'CORS_ORIGIN entries must be absolute http(s) origins.',
        });
        return;
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: 'CORS_ORIGIN entries must use http or https.',
        });
      }

      if (
        parsed.username ||
        parsed.password ||
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message:
            'CORS_ORIGIN entries must be bare origins without paths, queries, or credentials.',
        });
      }
    });
  })
  .transform((origins) => [
    ...new Set(
      origins.flatMap((origin) => {
        try {
          return [new URL(origin).origin];
        } catch {
          return [];
        }
      }),
    ),
  ]);

function optionalUrl(name: string, protocols: string[], description: string) {
  return z
    .string()
    .refine((value) => {
      try {
        return protocols.includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, `${name} must be a valid ${description} URL.`)
    .optional();
}

function optionalPositiveInteger(name: string) {
  const message = `${name} must be a positive integer.`;

  return z.coerce
    .number({ error: message })
    .int(message)
    .positive(message)
    .optional();
}

function nonEmptySecret(name: string) {
  return z.string().min(1, `${name} must not be empty.`).optional();
}

export const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: portSchema,
    CORS_ORIGIN: corsOriginSchema,
    DATABASE_URL: optionalUrl(
      'DATABASE_URL',
      ['postgres:', 'postgresql:'],
      'PostgreSQL',
    ),
    REDIS_URL: optionalUrl('REDIS_URL', ['redis:', 'rediss:'], 'Redis'),
    STELLAR_NETWORK: z.enum(['testnet', 'public']).default('testnet'),
    API_KEY: nonEmptySecret('API_KEY'),
    JWT_SECRET: nonEmptySecret('JWT_SECRET'),
    JWT_REFRESH_SECRET: nonEmptySecret('JWT_REFRESH_SECRET'),
    PLATFORM_WALLET_SECRET: nonEmptySecret('PLATFORM_WALLET_SECRET'),
    SENDGRID_API_KEY: nonEmptySecret('SENDGRID_API_KEY'),
    AWS_ACCESS_KEY_ID: nonEmptySecret('AWS_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: nonEmptySecret('AWS_SECRET_ACCESS_KEY'),
    METRICS_ENABLED: z.enum(['true', 'false']).optional(),
    REDIS_ENABLED: z.enum(['true', 'false']).optional(),
    REQUEST_TIMEOUT_MS: optionalPositiveInteger('REQUEST_TIMEOUT_MS'),
    RATE_LIMIT_MAX: optionalPositiveInteger('RATE_LIMIT_MAX'),
    RATE_LIMIT_WINDOW_MS: optionalPositiveInteger('RATE_LIMIT_WINDOW_MS'),
    PRISMA_SLOW_QUERY_MS: optionalPositiveInteger('PRISMA_SLOW_QUERY_MS'),
    REVOKED_TOKEN_RETENTION_DAYS: optionalPositiveInteger(
      'REVOKED_TOKEN_RETENTION_DAYS',
    ),
    TRENDING_DECAY_RATE_PER_HOUR: z.coerce
      .number({
        error: 'TRENDING_DECAY_RATE_PER_HOUR must be a non-negative number.',
      })
      .finite('TRENDING_DECAY_RATE_PER_HOUR must be a non-negative number.')
      .nonnegative(
        'TRENDING_DECAY_RATE_PER_HOUR must be a non-negative number.',
      )
      .optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when NODE_ENV is production.',
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): Environment {
  const result = environmentSchema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) =>
          `- ${issue.path.join('.') || 'configuration'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}
