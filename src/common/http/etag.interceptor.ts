import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { EMPTY, Observable, of, switchMap } from 'rxjs';
import { etagMatches, generateETag } from './etag.util';

/**
 * Adds conditional-request support to read endpoints.
 *
 * For GET/HEAD responses it generates a weak ETag from the serialized body
 * and honors the client's `If-None-Match` header: when the validator still
 * matches, the body is dropped and a `304 Not Modified` is returned so
 * clients can reuse their cached copy. See `docs/caching-strategy.md`.
 */
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return next.handle();
    }

    return next.handle().pipe(
      switchMap((body) => {
        if (
          response.statusCode !== 200 ||
          body === null ||
          body === undefined
        ) {
          return of(body);
        }

        const etag = generateETag(body);
        response.setHeader('ETag', etag);

        // Clients may cache but must revalidate before reuse.
        if (!response.getHeader('Cache-Control')) {
          response.setHeader('Cache-Control', 'no-cache');
        }

        if (etagMatches(request.headers['if-none-match'], etag)) {
          response.removeHeader('Content-Type');
          response.removeHeader('Content-Length');
          response.status(HttpStatus.NOT_MODIFIED).end();
          return EMPTY;
        }

        return of(body);
      }),
    );
  }
}
