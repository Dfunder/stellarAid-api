import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `PATCH /auth/reset-password/:token`.
 *
 * Carries only the new password — the reset token itself lives in the URL
 * so an attacker who only sees the body cannot replay it.
 */
export class ResetPasswordDto {
  @IsString({ message: 'password must be a string' })
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128, { message: 'password must be at most 128 characters' })
  password!: string;
}
