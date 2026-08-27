import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { DEPRECATED_API, DeprecationInfo } from './deprecation.decorator';

/**
 * Adds RFC 8594 `Deprecation` and `Sunset` headers to responses of routes
 * annotated with {@link DeprecatedApi}, supporting a graceful deprecation plan.
 */
@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const info = this.reflector.getAllAndOverride<DeprecationInfo | undefined>(
      DEPRECATED_API,
      [context.getHandler(), context.getClass()],
    );
    if (info) {
      const res = context.switchToHttp().getResponse<Response>();
      res.setHeader('Deprecation', 'true');
      if (info.sunset) res.setHeader('Sunset', info.sunset);
      res.setHeader('Link', '</api/docs>; rel="deprecation"; type="text/html"');
      if (info.message)
        res.setHeader('X-API-Deprecation-Message', info.message);
    }
    return next.handle();
  }
}
