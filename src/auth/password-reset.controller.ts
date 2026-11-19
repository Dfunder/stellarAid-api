import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Injectable,
  Post,
  Headers,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { resolveLocale, translate } from '@/i18n/messages';

export const PASSWORD_RESET_HANDLER = 'PASSWORD_RESET_HANDLER';

/** Implemented by the auth service that owns `resetPassword()`. */
export interface PasswordResetHandler {
  resetPassword(token: string, newPassword: string): Promise<void>;
}

export class ConfirmPasswordResetDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
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
  async confirm(
    @Body() body: ConfirmPasswordResetDto,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<void> {
    const locale = resolveLocale(acceptLanguage);
    if (typeof body?.token !== 'string' || body.token === '') {
      throw new BadRequestException(
        translate(locale, 'auth.reset.tokenRequired'),
      );
    }
    if (typeof body.password !== 'string' || body.password.length < 8) {
      throw new BadRequestException(
        translate(locale, 'validation.password.minLength'),
      );
    }
    try {
      await this.handler.resetPassword(body.token, body.password);
    } catch {
      throw new BadRequestException(translate(locale, 'auth.reset.invalid'));
    }
  }
}
