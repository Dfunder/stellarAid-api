import type { INestApplication } from '@nestjs/common';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import helmet from 'helmet';

/** Swagger UI is served under this path and needs a looser policy. */
export const DOCS_PATH_PREFIX = '/api/v1/docs';

/**
 * Policy for JSON API responses. They are never rendered as a page, so the
 * browser is told to load nothing from them and never to frame them.
 * Cross-origin reads stay allowed because CORS is configured in `main.ts`.
 */
const apiHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * Policy for the Swagger UI pages. Swagger UI loads its own scripts and
 * styles, applies inline styles, and shows images from `data:` URIs and the
 * Swagger validator badge. Everything else stays blocked, and
 * `upgrade-insecure-requests` is left out so the docs work over plain HTTP in
 * local development.
 */
const docsHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://validator.swagger.io'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
});

/** Choose the header policy that fits the requested path. */
export function securityHeaders(
  request: ExpressRequest,
  response: ExpressResponse,
  next: NextFunction,
): void {
  const path = request.path ?? request.url;
  const handler = path.startsWith(DOCS_PATH_PREFIX) ? docsHeaders : apiHeaders;
  handler(request, response, next);
}

/**
 * Enable Helmet security headers. Call this before any other middleware so
 * every response, including early error responses, carries the headers.
 */
export function configureSecurityHeaders(app: INestApplication): void {
  app.use(securityHeaders);
}
