import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import {
  UserRole,
  UserStatus,
} from '../users/schemas/user.schema';
import { JwtPayload } from './guards/jwt-auth.guard';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }): Promise<JwtPayload> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // Reject tokens for suspended accounts so an already-issued JWT
    // can't bypass a status change. (Ported from upstream/main's
    // src/auth/strategies/jwt.strategy.ts to keep parity with the
    // suspended-status enforcement that landed there.)
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account suspended');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: user.role ?? UserRole.USER,
    };
  }
}
