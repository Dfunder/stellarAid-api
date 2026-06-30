import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { AuthThrottlerGuard } from '../throttler/auth-throttler.guard';
import { sendError, sendSuccess } from '../utils/response.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Res() res: Response): Promise<Response> {
    try {
      const result = await this.authService.register({
        fullName: dto.fullName,
        email: dto.email,
        password: dto.password,
      });
      return sendSuccess(
        res,
        result,
        'User registered. Please verify your email to activate your account.',
        HttpStatus.CREATED,
      );
    } catch (err) {
      if (err instanceof ConflictException) {
        return sendError(res, err.message, HttpStatus.CONFLICT);
      }
      throw err;
    }
  }

  /**
   * Issue #369 — `PATCH /auth/reset-password/:token`.
   *
   * Completes the password-reset flow that began when the user clicked
   * the link in their "forgot password" email. The token arrives in the
   * URL; the new password arrives in the body.
   *
   * Marked `@Public()` because the user has no access token at this
   * point (the whole point of the flow is to recover one).
   *
   * `AuthThrottlerGuard` is layered on top of the global `ThrottlerGuard`
   * to give this brute-force-prone endpoint an extra IP-budget cap
   * (10 reqs / 15 min) in addition to whatever the global guard allows.
   */
  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Patch('reset-password/:token')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('token') token: string,
    @Body() dto: ResetPasswordDto,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      await this.authService.resetPassword(token, dto.password);
      return sendSuccess(
        res,
        undefined,
        'Password reset successfully. Please log in with your new password.',
        HttpStatus.OK,
      );
    } catch (err) {
      if (err instanceof BadRequestException) {
        return sendError(res, err.message, HttpStatus.BAD_REQUEST);
      }
      throw err;
    }
  }
}
