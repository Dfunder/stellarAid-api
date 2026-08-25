import { validate } from './env.validation';

const requiredEnvironment = {
  DATABASE_URL: 'postgresql://localhost/stellaraid',
  JWT_SECRET: 'jwt-secret',
  JWT_REFRESH_SECRET: 'jwt-refresh-secret',
  REDIS_URL: 'redis://localhost:6379',
  STELLAR_NETWORK: 'TESTNET',
  PLATFORM_WALLET_SECRET: 'platform-wallet-secret',
  ESCROW_CONTRACT_ID: 'escrow-contract-id',
  SENDGRID_API_KEY: 'sendgrid-api-key',
  AWS_S3_BUCKET: 'stellar-aid',
  AWS_ACCESS_KEY_ID: 'aws-access-key-id',
  AWS_SECRET_ACCESS_KEY: 'aws-secret-access-key',
  WALLET_ENCRYPTION_KEY: 'a'.repeat(64),
};

describe('environment validation', () => {
  it('returns the configuration when all required variables are set', () => {
    expect(validate(requiredEnvironment)).toBe(requiredEnvironment);
  });

  it('reports every missing or blank variable', () => {
    expect(() =>
      validate({
        ...requiredEnvironment,
        DATABASE_URL: ' ',
        JWT_SECRET: undefined,
        WALLET_ENCRYPTION_KEY: undefined,
      }),
    ).toThrow(
      'Missing required environment variables: DATABASE_URL, JWT_SECRET, WALLET_ENCRYPTION_KEY',
    );
  });
});