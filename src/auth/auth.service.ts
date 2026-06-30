import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { hashUserPassword } from '../users/schemas/user.schema';

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface RegisterResult {
  id: string;
  fullName: string;
  email: string;
  isVerified: boolean;
}

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private readonly configService: ConfigService,
  ) {}

  async register(input: RegisterInput): Promise<RegisterResult> {
    const normalized = input.email.toLowerCase().trim();

    const existing = await this.usersService.findByEmail(normalized);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.usersService.create({
      fullName: input.fullName,
      email: normalized,
      password: input.password,
    });

    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = token;
    user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
    await user.save();

    try {
      await this.mailService.sendVerificationEmail({
        to: user.email,
        name: user.fullName,
        token,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to send verification email to ${user.email}: ${(err as Error).message}`,
      );
    }

    return {
      id: user._id?.toString() ?? '',
      fullName: user.fullName,
      email: user.email,
      isVerified: user.isVerified,
    };
  }

  /**
   * Reset a user's password using the one-time token delivered to their
   * inbox (issue #369).
   *
   * The token is matched against `User.passwordResetToken`, which stores
   * a SHA-256 hash of the original token rather than the raw value — this
   * way a leaked DB snapshot cannot be used to compromise any pending
   * reset. Expiry is enforced against `User.passwordResetExpires`.
   *
   * On success the new password is bcrypt-hashed and the reset token,
   * reset expiry, refresh token hash, and refresh token expiry are all
   * cleared so any previously active session can no longer be refreshed.
   *
   * @throws BadRequestException when the token is unknown, malformed, or
   *   expired. The same message is used in all three cases so the endpoint
   *   does not leak which condition failed.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = hashResetToken(token);
    const user = await this.usersService.findByPasswordResetToken(hashedToken);

    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await hashUserPassword(newPassword);

    await this.usersService.update(user._id?.toString() ?? '', {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      refreshTokenHash: null,
      refreshTokenExpires: null,
    });
  }
}

/**
 * SHA-256 hex digest of a raw reset token. The raw token is what gets
 * delivered to the user; only the digest lives in the database.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
