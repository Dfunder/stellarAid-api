import {
  CallHandler, CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable,
  NestInterceptor, RequestTimeoutException, UnauthorizedException,
} from '@nestjs/common';
import { Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs';

/** #1100: fail requests that exceed REQUEST_TIMEOUT_MS (default 30s). Register via APP_INTERCEPTOR. */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ms = Number(process.env.REQUEST_TIMEOUT_MS) || 30000;
    return next.handle().pipe(
      timeout(ms),
      catchError((err) =>
        throwError(() => (err instanceof TimeoutError ? new RequestTimeoutException('Request timed out') : err)),
      ),
    );
  }
}

/** #1101: opt-in guard; use @UseGuards(ApiKeyGuard). Expects header `x-api-key` equal to API_KEY env. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const expected = process.env.API_KEY;
    const given = ctx.switchToHttp().getRequest().headers?.['x-api-key'];
    if (!expected || given !== expected) throw new UnauthorizedException('Invalid or missing API key');
    return true;
  }
}

/** #1102: tiny in-memory rate limiter (RATE_LIMIT_MAX per RATE_LIMIT_WINDOW_MS per IP). Scaffold only. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  canActivate(ctx: ExecutionContext): boolean {
    const max = Number(process.env.RATE_LIMIT_MAX) || 100;
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
    const ip: string = ctx.switchToHttp().getRequest().ip ?? 'unknown';
    const now = Date.now();
    const entry = this.hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (++entry.count > max) throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
