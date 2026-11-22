import { validateEnvironment } from './environment';

describe('environment validation', () => {
  it('applies safe defaults', () => {
    expect(validateEnvironment({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGIN: [],
      STELLAR_NETWORK: 'testnet',
    });
  });

  it('parses, normalizes, and de-duplicates CORS origins', () => {
    const env = validateEnvironment({
      CORS_ORIGIN:
        ' https://App.example.com , http://localhost:3001,https://app.example.com ',
    });

    expect(env.CORS_ORIGIN).toEqual([
      'https://app.example.com',
      'http://localhost:3001',
    ]);
  });

  it('rejects invalid ports with a clear message', () => {
    expect(() => validateEnvironment({ PORT: 'abc' })).toThrow(
      /PORT must be an integer between 1 and 65535/,
    );
    expect(() => validateEnvironment({ PORT: '0' })).toThrow(
      /PORT must be an integer between 1 and 65535/,
    );
    expect(() => validateEnvironment({ PORT: '65536' })).toThrow(
      /PORT must be an integer between 1 and 65535/,
    );
  });

  it('rejects unsafe or malformed CORS origins', () => {
    expect(() => validateEnvironment({ CORS_ORIGIN: '*' })).toThrow(
      /CORS_ORIGIN.*absolute http\(s\) origins/,
    );
    expect(() =>
      validateEnvironment({ CORS_ORIGIN: 'https://app.example.com/path' }),
    ).toThrow(/bare origins/);
    expect(() =>
      validateEnvironment({
        CORS_ORIGIN: 'https://user:password@app.example.com',
      }),
    ).toThrow(/bare origins/);
  });

  it('rejects unsupported environments', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('requires and validates production database configuration', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      /DATABASE_URL is required when NODE_ENV is production/,
    );
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'mysql://user:password@localhost:3306/stellaraid',
      }),
    ).toThrow(/DATABASE_URL.*PostgreSQL URL/);

    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/stellaraid',
      }).DATABASE_URL,
    ).toBe('postgresql://user:password@localhost:5432/stellaraid');
  });

  it('validates optional numeric and boolean settings', () => {
    const env = validateEnvironment({
      REQUEST_TIMEOUT_MS: '5000',
      RATE_LIMIT_MAX: '100',
      METRICS_ENABLED: 'false',
      TRENDING_DECAY_RATE_PER_HOUR: '0',
    });

    expect(env).toMatchObject({
      REQUEST_TIMEOUT_MS: 5000,
      RATE_LIMIT_MAX: 100,
      METRICS_ENABLED: 'false',
      TRENDING_DECAY_RATE_PER_HOUR: 0,
    });
    expect(() => validateEnvironment({ RATE_LIMIT_MAX: 'many' })).toThrow(
      /RATE_LIMIT_MAX must be a positive integer/,
    );
    expect(() => validateEnvironment({ METRICS_ENABLED: 'yes' })).toThrow(
      /METRICS_ENABLED/,
    );
  });
});
