import { applyDecorators, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RoleRateLimitOptions {
  ttl: number;
  limits: Partial<Record<Role, number>>;
  defaultLimit: number;
}

export const RateLimit = (limit: number, ttl: number) =>
  Throttle({ default: { limit, ttl } });

export const RoleRateLimit = (options: RoleRateLimitOptions) => {
  const limit = (context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: Role };
      headers: { authorization?: string };
    }>();
    const role = request.user?.role || decodeJwt(request.headers.authorization)?.role;
    return (role && options.limits[role]) || options.defaultLimit;
  };

  return applyDecorators(
    Throttle({ default: { limit, ttl: options.ttl } }),
    SetMetadata(RATE_LIMIT_KEY, options),
  );
};

export function decodeJwt(authorization?: string): { sub?: string; role?: Role } | undefined {
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7).split('.')[1]
    : undefined;
  if (!token) return undefined;

  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString()) as {
      sub?: string;
      role?: Role;
    };
  } catch {
    return undefined;
  }
}