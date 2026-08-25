import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { SanitizeString } from '../../common/validation/sanitize-string.decorator';

export class RegisterDto {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  @SanitizeString()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @SanitizeString()
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'User password. Must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character.',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
    message:
      'Password must contain an uppercase letter, a lowercase letter, a number and a special character',
  })
  password: string;

  @ApiProperty({
    enum: Role,
    description: 'User role',
    example: Role.ARTIST,
  })
  @IsEnum(Role)
  role: Role;
}
