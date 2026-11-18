export interface AccessClaims {
  sub: string;
  exp: number;
  iat?: number;
}

/**
 * Validate a decoded JWT payload. A missing `sub` must be rejected: coercing
 * it with `String(payload.sub)` would turn `undefined` into the user id
 * "undefined".
 */
export function validateAccessClaims(
  payload: unknown,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): AccessClaims {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid token payload');
  }
  const { sub, exp, iat } = payload as Record<string, unknown>;

  if (typeof sub !== 'string' || sub.trim() === '') {
    throw new Error('Token is missing a subject');
  }
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    throw new Error('Token is missing an expiry');
  }
  if (exp <= nowSeconds) {
    throw new Error('Token has expired');
  }
  if (iat !== undefined && (typeof iat !== 'number' || iat > nowSeconds + 60)) {
    throw new Error('Token issued-at is invalid');
  }

  return { sub, exp, iat: iat as number | undefined };
}
