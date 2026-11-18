import { createSignedToken, verifySignedToken } from './signed-token';
import { validateAccessClaims } from './token-claims';

describe('validateAccessClaims', () => {
  it('rejects a missing sub', () => {
    expect(() => validateAccessClaims({ exp: 9_999_999_999 })).toThrow();
  });

  it('accepts valid claims', () => {
    expect(validateAccessClaims({ sub: 'u1', exp: 9_999_999_999 }).sub).toBe(
      'u1',
    );
  });
});

describe('signed tokens', () => {
  it('round-trips and rejects wrong purpose or tampering', () => {
    const token = createSignedToken('u1', 'password-reset', 's3cret', 60, 0);
    expect(verifySignedToken(token, 'password-reset', 's3cret', 1)).toBe('u1');
    expect(() => verifySignedToken(token, 'email-verification', 's3cret', 1))
      .toThrow();
    expect(() => verifySignedToken(token + 'x', 'password-reset', 's3cret', 1))
      .toThrow();
    expect(() => verifySignedToken(token, 'password-reset', 's3cret', 100))
      .toThrow();
  });
});
