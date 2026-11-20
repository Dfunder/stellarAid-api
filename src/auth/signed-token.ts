import { createHmac, timingSafeEqual } from 'node:crypto';

export type TokenPurpose = 'email-verification' | 'password-reset';

interface TokenPayload {
  uid: string;
  purpose: TokenPurpose;
  exp: number;
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

/** Stateless, expiring token used for email verification and password reset. */
export function createSignedToken(
  userId: string,
  purpose: TokenPurpose,
  secret: string,
  ttlSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const payload: TokenPayload = {
    uid: userId,
    purpose,
    exp: nowSeconds + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

/** Returns the user id when the token is authentic, unexpired and on-purpose. */
export function verifySignedToken(
  token: string,
  purpose: TokenPurpose,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new Error('Malformed token');

  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(
    Buffer.from(body, 'base64url').toString('utf8'),
  ) as Partial<TokenPayload>;
  if (payload.purpose !== purpose) throw new Error('Wrong token purpose');
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new Error('Token has expired');
  }
  if (typeof payload.uid !== 'string') throw new Error('Malformed token');
  return payload.uid;
}
