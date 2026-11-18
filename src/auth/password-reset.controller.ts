import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Injectable,
  Post,
} from '@nestjs/common';

export const PASSWORD_RESET_HANDLER = 'PASSWORD_RESET_HANDLER';

/** Implemented by the auth service that owns `resetPassword()`. */
export interface PasswordResetHandler {
  resetPassword(token: string, newPassword: string): Promise<void>;
}

export class ConfirmPasswordResetDto {
  token!: string;
  password!: string;
}

@Injectable()
@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(
    @Inject(PASSWORD_RESET_HANDLER)
    private readonly handler: PasswordResetHandler,
  ) {}

  @Post('confirm')
  @HttpCode(204)
  async confirm(@Body() body: ConfirmPasswordResetDto): Promise<void> {
    if (typeof body?.token !== 'string' || body.token === '') {
      throw new BadRequestException('token is required');
    }
    if (typeof body.password !== 'string' || body.password.length < 8) {
      throw new BadRequestException('password must be at least 8 characters');
    }
    try {
      await this.handler.resetPassword(body.token, body.password);
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }
}
