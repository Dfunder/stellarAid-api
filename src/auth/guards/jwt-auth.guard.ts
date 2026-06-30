import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../../users/schemas/user.schema';

/**
 * Shape of the user object attached to the request by `JwtStrategy`.
 * Endpoints that inject `@CurrentUser()` should rely on this type so
 * consumers (controllers, guards) share a single contract regardless of
 * which passport strategy populated `req.user`.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/**
 * Single, project-wide JWT authentication guard. Honours the `@Public()`
 * metadata shortcut from `decorators/public.decorator.ts` so endpoint
 * authors can opt out of auth on a per-route basis without redeclaring
 * guards.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  // Signature intentionally mirrors `@nestjs/passport`'s base
  // `IAuthGuard.handleRequest<TUser>` (err/user/info: any) so this
  // override satisfies TS2416 without relying on method-parameter
  // bivariance. Casting `user` to `TUser` is honest about the passport
  // boundary; downstream callers (e.g. `@CurrentUser()`) get the
  // typed `JwtPayload` back without any further narrowing.
  handleRequest<TUser = JwtPayload>(
    err: any,
    user: any,
    _info: any,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Invalid or expired token');
    }
    return user as TUser;
  }
}
