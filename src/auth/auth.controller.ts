import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { RateLimit } from '../common/throttling/rate-limit.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  LoginSuccessResponse,
  RegistrationSuccessResponse,
} from './ro/auth.ro';

@ApiTags('auth')
@Controller({ version: '1', path: 'auth' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @RateLimit(3, 60000)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({
    type: RegisterDto,
    examples: {
      a: {
        summary: 'Register a new user',
        value: {
          email: 'test-user@gmail.com',
          password: 'password',
          name: 'Test User',
          role: 'ARTIST',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Verification email sent',
    type: RegistrationSuccessResponse,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  @RateLimit(5, 60000)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in a user' })
  @ApiBody({
    type: LoginDto,
    examples: {
      a: {
        summary: 'Artist Login',
        value: { email: 'artist@lumora.io', password: 'SecurePassword123!' },
      },
      b: {
        summary: 'Client Login',
        value: { email: 'client@lumora.io', password: 'SecurePassword123!' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'JWT access token returned',
    type: LoginSuccessResponse,
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
