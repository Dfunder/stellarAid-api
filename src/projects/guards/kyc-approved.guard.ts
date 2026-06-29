import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../../auth/guards/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import { KycStatus } from '../../users/schemas/user.schema';

@Injectable()
export class KycApprovedGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const user = await this.usersService.findById(request.user.sub);

    if (!user || user.kycStatus !== KycStatus.APPROVED) {
      throw new ForbiddenException('KYC approval required to perform this action');
    }

    return true;
  }
}
