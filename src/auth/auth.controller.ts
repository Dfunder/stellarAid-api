import {
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Public } from './decorators/public.decorator';
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
}
