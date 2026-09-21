import { ApiProperty } from '@nestjs/swagger';

export class UserRo {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Unique identifier for the user',
  })
  id: string;

  @ApiProperty({
    example: 'artist@lumora.io',
    description: 'Registered user email address',
  })
  email: string;

  @ApiProperty({
    example: 'Elena Rostova',
    description: 'Full name or display name of the user',
  })
  name: string;

  @ApiProperty({
    example: 'ARTIST',
    description: 'User platform role (e.g. ARTIST, CLIENT, ADMIN)',
  })
  role: string;

  @ApiProperty({
    example: null,
    nullable: true,
    required: false,
    description:
      'Connected Stellar public wallet address (or null if unlinked)',
  })
  walletAddress: string | null;
}

export class RegistrationSuccessResponse {
  @ApiProperty({
    example:
      'Registration successful. Please verify your email to activate your account.',
    description: 'Status confirmation message for registration',
  })
  message: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
    description: 'Identifier of the registered user',
  })
  userId?: string;
}

export class LoginSuccessResponse {
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjEyMzQ1Njc4OTAiLCJlbWFpbCI6ImFydGlzdEBsdW1vcmEuaW8iLCJyb2xlIjoiQVJUSVNUIiwiaWF0IjoxNzA4ODAwMDAwLCJleHAiOjE3MDg4ODY0MDB9.abcdef...',
    description:
      'Short-lived cryptographically signed JWT access token for API authorization',
  })
  accessToken: string;

  @ApiProperty({
    type: () => UserRo,
    description: 'Authenticated user profile details',
  })
  user?: UserRo;
}

export class SessionSuccessResponse {
  @ApiProperty({
    example: {
      sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      email: 'artist@lumora.io',
      role: 'ARTIST',
      iat: 1708800000,
      exp: 1708800900,
    },
    description: 'Decoded JWT claims for the currently active session',
  })
  user: {
    sub: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
  };
}

/**
 * Standard base error response schema serialized by the global HttpExceptionFilter.
 */
export class AuthErrorResponseDto {
  @ApiProperty({
    example: 'error',
    description: 'Top-level response status indicator',
  })
  status: string;

  @ApiProperty({
    example: 'Invalid credentials',
    description:
      'Descriptive error message or list of validation error strings',
  })
  message: string;

  @ApiProperty({
    example: null,
    nullable: true,
    required: false,
    type: 'string',
    description: 'Error response payload container (always null on failure)',
  })
  data: string | null;

  @ApiProperty({
    example: 'UNAUTHORIZED',
    description: 'Application-level machine-readable error classification code',
  })
  errorCode: string;

  @ApiProperty({
    example: '6a7f8e9d-0c1b-2a3f-4e5d-6c7b8a9e0f1d',
    nullable: true,
    description:
      'Correlation request ID (X-Request-Id) for end-to-end log tracing',
  })
  requestId: string | null;

  @ApiProperty({
    example: '2026-09-21T12:00:00.000Z',
    description: 'ISO 8601 timestamp when the exception was recorded',
  })
  timestamp: string;

  @ApiProperty({
    example: '/v1/auth/login',
    description: 'Endpoint URL path that triggered the exception',
  })
  path: string;
}

/**
 * HTTP 401 Unauthorized error response example.
 */
export class UnauthorizedErrorResponse {
  @ApiProperty({ example: 'error' })
  status: string;

  @ApiProperty({
    example: 'Invalid credentials',
    description:
      'Failure message indicating incorrect credentials or unverified account state',
  })
  message: string;

  @ApiProperty({
    example: null,
    nullable: true,
    required: false,
    type: 'string',
  })
  data: string | null;

  @ApiProperty({ example: 'UNAUTHORIZED' })
  errorCode: string;

  @ApiProperty({ example: '6a7f8e9d-0c1b-2a3f-4e5d-6c7b8a9e0f1d' })
  requestId: string | null;

  @ApiProperty({ example: '2026-09-21T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/v1/auth/login' })
  path: string;
}

/**
 * HTTP 409 Conflict error response example.
 */
export class ConflictErrorResponse {
  @ApiProperty({ example: 'error' })
  status: string;

  @ApiProperty({
    example: 'User with this email already exists',
    description:
      'Failure message indicating existing account duplicate collision',
  })
  message: string;

  @ApiProperty({
    example: null,
    nullable: true,
    required: false,
    type: 'string',
  })
  data: string | null;

  @ApiProperty({ example: 'CONFLICT' })
  errorCode: string;

  @ApiProperty({ example: '6a7f8e9d-0c1b-2a3f-4e5d-6c7b8a9e0f1d' })
  requestId: string | null;

  @ApiProperty({ example: '2026-09-21T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/v1/auth/register' })
  path: string;
}

/**
 * HTTP 400 Bad Request / HTTP 422 Unprocessable Entity validation error response example.
 */
export class ValidationErrorResponse {
  @ApiProperty({ example: 'error' })
  status: string;

  @ApiProperty({
    example: [
      'email must be an email',
      'Password must contain an uppercase letter, a lowercase letter, a number and a special character',
    ],
    type: [String],
    description:
      'Array of validation failure messages generated by ClassValidator pipe',
  })
  message: string[];

  @ApiProperty({
    example: null,
    nullable: true,
    required: false,
    type: 'string',
  })
  data: string | null;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  errorCode: string;

  @ApiProperty({ example: '6a7f8e9d-0c1b-2a3f-4e5d-6c7b8a9e0f1d' })
  requestId: string | null;

  @ApiProperty({ example: '2026-09-21T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/v1/auth/register' })
  path: string;
}

/**
 * HTTP 429 Too Many Requests rate limit error response example.
 */
export class RateLimitErrorResponse {
  @ApiProperty({ example: 'error' })
  status: string;

  @ApiProperty({
    example: 'ThrottlerException: Too Many Requests',
    description: 'Failure message when rate limit threshold has been exceeded',
  })
  message: string;

  @ApiProperty({
    example: null,
    nullable: true,
    required: false,
    type: 'string',
  })
  data: string | null;

  @ApiProperty({ example: 'TOO_MANY_REQUESTS' })
  errorCode: string;

  @ApiProperty({ example: '6a7f8e9d-0c1b-2a3f-4e5d-6c7b8a9e0f1d' })
  requestId: string | null;

  @ApiProperty({ example: '2026-09-21T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/v1/auth/login' })
  path: string;
}
