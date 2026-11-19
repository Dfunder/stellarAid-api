import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Injectable,
  Post,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';

export const PASSWORD_RESET_HANDLER = 'PASSWORD_RESET_HANDLER';

/** Implemented by the auth service that owns `resetPassword()`. */
export interface PasswordResetHandler {
  resetPassword(token: string, newPassword: string): Promise<void>;
}

export class ConfirmPasswordResetDto {
  @IsString({ message: 'Enter a valid password reset token.' })
  token!: string;

  @MinLength(8, { message: 'Password must contain at least 8 characters.' })
  @IsString({ message: 'Enter a valid password.' })
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
    try {
      await this.handler.resetPassword(body.token, body.password);
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }
}
