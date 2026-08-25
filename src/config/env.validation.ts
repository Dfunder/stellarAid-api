const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'REDIS_URL',
  'STELLAR_NETWORK',
  'PLATFORM_WALLET_SECRET',
  'ESCROW_CONTRACT_ID',
  'SENDGRID_API_KEY',
  'AWS_S3_BUCKET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'WALLET_ENCRYPTION_KEY',
] as const;

export function validate(config: Record<string, unknown>) {
  const missing = REQUIRED_ENV_VARS.filter((name) => {
    const value = config[name];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  return config;
}