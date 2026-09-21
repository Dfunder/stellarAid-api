import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { RateLimit } from '../common/throttling/rate-limit.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './sync/jwt.auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './decorators/current-user.decorator';
import {
  ConflictErrorResponse,
  LoginSuccessResponse,
  RateLimitErrorResponse,
  RegistrationSuccessResponse,
  SessionSuccessResponse,
  UnauthorizedErrorResponse,
  ValidationErrorResponse,
} from './ro/auth.ro';

@ApiTags('auth')
@Controller({ version: '1', path: 'auth' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @RateLimit(3, 60000)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a user account with PENDING_VERIFICATION status, generates a secure password hash, and dispatches an OTP email.',
  })
  @ApiBody({
    type: RegisterDto,
    examples: {
      artist: {
        summary: 'Register an Artist Account',
        value: {
          email: 'artist@lumora.io',
          password: 'SecurePassword123!',
          name: 'Elena Rostova',
          role: 'ARTIST',
        },
      },
      client: {
        summary: 'Register a Client Account',
        value: {
          email: 'client@lumora.io',
          password: 'SecurePassword123!',
          name: 'Marcus Vance',
          role: 'CLIENT',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully; verification email dispatched.',
    type: RegistrationSuccessResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request - Missing or invalid payload parameters.',
    type: ValidationErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Conflict - User with this email address already exists.',
    type: ConflictErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description:
      'Unprocessable Entity - Payload fails semantic validation rules.',
    type: ValidationErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description:
      'Too Many Requests - Rate limit exceeded (maximum 3 registrations per minute).',
    type: RateLimitErrorResponse,
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  @RateLimit(5, 60000)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in a user',
    description:
      'Validates credentials against password hash and active account status, issuing a short-lived JWT access token.',
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      artist: {
        summary: 'Artist Login',
        value: { email: 'artist@lumora.io', password: 'SecurePassword123!' },
      },
      client: {
        summary: 'Client Login',
        value: { email: 'client@lumora.io', password: 'SecurePassword123!' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User authenticated successfully; JWT access token returned.',
    type: LoginSuccessResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Bad Request - Malformed request body or invalid email format.',
    type: ValidationErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description:
      'Unauthorized - Invalid email/password credentials or unverified account.',
    type: UnauthorizedErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Unprocessable Entity - Payload fails validation schema.',
    type: ValidationErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description:
      'Too Many Requests - Rate limit exceeded (maximum 5 login attempts per minute).',
    type: RateLimitErrorResponse,
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current authenticated session',
    description:
      'Validates the Bearer JWT access token and returns decoded session claims for the authenticated caller.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active session claims retrieved successfully.',
    type: SessionSuccessResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description:
      'Unauthorized - Missing, expired, or invalid Bearer JWT token.',
    type: UnauthorizedErrorResponse,
  })
  session(@CurrentUser() user: JwtPayload) {
    return { user };
  }
}
