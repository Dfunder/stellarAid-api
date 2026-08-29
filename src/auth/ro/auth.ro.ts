import { ApiProperty } from '@nestjs/swagger';

class User {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'artist@lumora.io' })
  email: string;

  @ApiProperty({ example: 'Elena Rostova' })
  name: string;

  @ApiProperty({ example: 'ARTIST' })
  role: string;

  @ApiProperty({ example: null })
  walletAddress: string | null;
}

export class RegistrationSuccessResponse {
  @ApiProperty({
    example:
      'Registration successful. Please verify your email to activate your account.',
  })
  message: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  userId: string;
}

export class LoginSuccessResponse {
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjEyMzQ1Njc4OTAiLCJlbWFpbCI6ImFydGlzdEBsdW1vcmEuaW8iLCJyb2xlIjoiQVJUSVNUIiwiaWF0IjoxNzA4ODAwMDAwLCJleHAiOjE3MDg4ODY0MDB9.abcdef...',
  })
  accessToken: string;

  @ApiProperty({ type: () => User })
  user: User;
}
