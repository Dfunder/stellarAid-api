import { getCompressionSettings } from './compression.config';

describe('getCompressionSettings', () => {
  it('enables compression with level 6 in production', () => {
    const { enabled, options } = getCompressionSettings({
      NODE_ENV: 'production',
    });
    expect(enabled).toBe(true);
    expect(options.level).toBe(6);
    expect(options.threshold).toBe(1024);
  });

  it('uses a fast level in development', () => {
    const { enabled, options } = getCompressionSettings({
      NODE_ENV: 'development',
    });
    expect(enabled).toBe(true);
    expect(options.level).toBe(1);
  });

  it('disables compression in tests by default', () => {
    const { enabled } = getCompressionSettings({
      NODE_ENV: 'test',
    });
    expect(enabled).toBe(false);
  });

  it('honors COMPRESSION_ENABLED overrides', () => {
    expect(
      getCompressionSettings({
        NODE_ENV: 'production',
        COMPRESSION_ENABLED: 'false',
      }).enabled,
    ).toBe(false);
    expect(
      getCompressionSettings({
        NODE_ENV: 'test',
        COMPRESSION_ENABLED: 'true',
      }).enabled,
    ).toBe(true);
  });

  it('honors level and threshold overrides, clamped to valid ranges', () => {
    const { options } = getCompressionSettings({
      NODE_ENV: 'production',
      COMPRESSION_LEVEL: '42',
      COMPRESSION_THRESHOLD: '2048',
    });
    expect(options.level).toBe(9);
    expect(options.threshold).toBe(2048);
  });

  it('falls back to defaults for invalid values', () => {
    const { options } = getCompressionSettings({
      NODE_ENV: 'production',
      COMPRESSION_LEVEL: 'not-a-number',
      COMPRESSION_THRESHOLD: 'nope',
    });
    expect(options.level).toBe(6);
    expect(options.threshold).toBe(1024);
  });
});
