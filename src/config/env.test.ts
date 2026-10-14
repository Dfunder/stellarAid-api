import { describe, expect, it } from 'vitest';
import { schema } from './env';

describe('asset issuer env configuration validation', () => {
  const VALID_STELLAR_ACCOUNT = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
  const INVALID_ACCOUNT = 'invalid-not-stellar-account';

  it('accepts valid Stellar account addresses for asset issuers', () => {
    expect(schema.shape.USDC_ASSET_ISSUER.safeParse(VALID_STELLAR_ACCOUNT).success).toBe(true);
    expect(schema.shape.EURC_ASSET_ISSUER.safeParse(VALID_STELLAR_ACCOUNT).success).toBe(true);
    expect(schema.shape.NGNT_ASSET_ISSUER.safeParse(VALID_STELLAR_ACCOUNT).success).toBe(true);
  });

  it('rejects invalid account strings for asset issuers at startup', () => {
    const usdcResult = schema.shape.USDC_ASSET_ISSUER.safeParse(INVALID_ACCOUNT);
    expect(usdcResult.success).toBe(false);
    if (!usdcResult.success) {
      expect(usdcResult.error.issues[0]?.message).toBe('must be a Stellar account address');
    }

    const eurcResult = schema.shape.EURC_ASSET_ISSUER.safeParse(INVALID_ACCOUNT);
    expect(eurcResult.success).toBe(false);
    if (!eurcResult.success) {
      expect(eurcResult.error.issues[0]?.message).toBe('must be a Stellar account address');
    }

    const ngntResult = schema.shape.NGNT_ASSET_ISSUER.safeParse(INVALID_ACCOUNT);
    expect(ngntResult.success).toBe(false);
    if (!ngntResult.success) {
      expect(ngntResult.error.issues[0]?.message).toBe('must be a Stellar account address');
    }
  });

  it('treats empty strings as undefined', () => {
    expect(schema.shape.USDC_ASSET_ISSUER.parse('')).toBeUndefined();
    expect(schema.shape.EURC_ASSET_ISSUER.parse('')).toBeUndefined();
    expect(schema.shape.NGNT_ASSET_ISSUER.parse('')).toBeUndefined();
  });
});
