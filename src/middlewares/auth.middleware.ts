/**
 * Bearer-token authentication middleware.
 *
 * Verifies the `Authorization: Bearer <accessToken>` header and exposes the
 * decoded identity on `req.user`. Any missing, malformed, invalid or expired
 * token is rejected with 401.
 */

import type { Request, RequestHandler } from 'express';

import { verifyAccessToken, type AccessTokenPayload } from '@/services/token.service';

import { AppError } from './app-error.middleware';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const match = header === undefined ? null : /^Bearer\s+(\S+)$/i.exec(header);
  if (match === null || match[1] === undefined) {
    next(new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header'));
    return;
  }
  try {
    (req as AuthenticatedRequest).user = verifyAccessToken(match[1]);
    next();
  } catch (err) {
    next(err);
  }
};

/** Read the authenticated identity; only valid on routes behind `authenticate`. */
export function getAuthUser(req: Request): AccessTokenPayload {
  const user = (req as AuthenticatedRequest).user;
  if (user === undefined) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }
  return user;
}

/**
 * Best-effort identity read for public routes: returns the decoded identity
 * for a valid Bearer token, or `undefined` for a missing, malformed or
 * invalid one — never throws. Use on routes that behave the same for
 * anonymous and authenticated callers but want to know who's asking.
 */
export function getOptionalAuthUser(req: Request): AccessTokenPayload | undefined {
  const header = req.headers.authorization;
  const match = header === undefined ? null : /^Bearer\s+(\S+)$/i.exec(header);
  if (match === null || match[1] === undefined) {
    return undefined;
  }
  try {
    return verifyAccessToken(match[1]);
  } catch {
    return undefined;
  }
}
