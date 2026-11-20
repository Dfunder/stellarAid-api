import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(): never {
    throw new UnauthorizedException(
      'Admin access is unavailable until authentication and authorization are configured.',
    );
  }
}
