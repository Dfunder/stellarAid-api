/**
 * Authentication service — register, login and refresh token rotation.
 *
 * Responses never include the password hash. Login failures are deliberately
 * generic ("Invalid email or password") to avoid user enumeration.
 */

import { randomBytes } from 'node:crypto';

import { AppError } from '@/middlewares';
import { prisma } from '@/services';
import { comparePassword, hashPassword } from '@/utils';
import type { ArtistProfile, Prisma, Role, User } from '@prisma/client';

import {
  issueTokenPair,
  revokeAllUserTokens,
  revokeRefreshToken,
  revokeRefreshTokenByValue,
  verifyRefreshToken,
  type TokenPair,
} from './token.service';

export type PublicUser = {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly email: string;
  readonly role: Role;
  readonly emailVerified: boolean;
  readonly bio: string | null;
  readonly location: string | null;
  readonly website: string | null;
  readonly socialLinks: Prisma.JsonValue | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export interface feed {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly role: Role;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    bio: user.bio,
    location: user.location,
    website: user.website,
    socialLinks: user.socialLinks,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function usernameFromEmail(email: string): string {
  const base = (email.split('@')[0] ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  return base === '' ? 'user' : base;
}

async function uniqueUsername(email: string): Promise<string> {
  const base = usernameFromEmail(email);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}_${randomBytes(3).toString('hex')}`;
    const existing = await prisma.user.findUnique({ where: { username: candidate } });
    if (existing === null) {
      return candidate;
    }
  }
  throw new AppError('INTERNAL_ERROR', 'Could not allocate a unique username, please retry');
}

export async function registerUser(input: RegisterInput): Promise<{
  user: PublicUser;
  tokens: TokenPair;
  verificationToken: string;
}> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing !== null) {
    throw new AppError('CONFLICT', 'Email already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const username = await uniqueUsername(email);
  const verificationToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, passwordHash, name: input.name, username, role: input.role },
    });
    await tx.emailVerification.create({
      data: { userId: created.id, token: verificationToken, expiresAt },
    });
    return created;
  });

  const tokens = await issueTokenPair({ id: user.id, role: user.role });
  return { user: toPublicUser(user), tokens, verificationToken };
}

export async function loginUser(
  input: LoginInput,
): Promise<{ user: PublicUser; tokens: TokenPair }> {
  const email = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user === null || !(await comparePassword(input.password, user.passwordHash))) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password');
  }
  const tokens = await issueTokenPair({ id: user.id, role: user.role });
  return { user: toPublicUser(user), tokens };
}

export interface PublicWallet {
  readonly publicKey: string;
  readonly network: string;
  readonly verified: boolean;
  readonly createdAt: Date;
}

export type PublicArtistProfile = Omit<ArtistProfile, 'userId'>;

export interface CurrentUserProfile extends PublicUser {
  readonly wallets: PublicWallet[];
  readonly artistProfile: PublicArtistProfile | null;
}

/** Profile for GET /auth/me — never includes the password hash or token data. */
export async function getCurrentUser(userId: string): Promise<CurrentUserProfile> {
  const [user, wallets, artistProfile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.wallet.findMany({
      where: { userId },
      select: { publicKey: true, network: true, verified: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.artistProfile.findUnique({ where: { userId } }),
  ]);
  if (user === null) {
    throw new AppError('UNAUTHORIZED', 'User no longer exists');
  }
  let publicArtistProfile: PublicArtistProfile | null = null;
  if (artistProfile !== null) {
    const { userId: _userId, ...rest } = artistProfile;
    publicArtistProfile = rest;
  }
  return { ...toPublicUser(user), wallets, artistProfile: publicArtistProfile };
}

/**
 * Revoke a single refresh token owned by `userId`. Idempotent: unknown,
 * foreign or already-revoked tokens are silently ignored.
 */
export async function logoutSession(userId: string, rawToken: string): Promise<void> {
  await revokeRefreshTokenByValue(userId, rawToken);
}

/** Revoke every active refresh token for the user (all sessions). */
export async function logoutAllSessions(userId: string): Promise<void> {
  await revokeAllUserTokens(userId);
}

export async function refreshSession(rawToken: string): Promise<{
  user: PublicUser;
  tokens: TokenPair;
}> {
  const { refreshTokenId, sub } = await verifyRefreshToken(rawToken);
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (user === null) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired refresh token');
  }
  await revokeRefreshToken(refreshTokenId);
  const tokens = await issueTokenPair({ id: user.id, role: user.role });
  return { user: toPublicUser(user), tokens };
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user !== null) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await prisma.$transaction([
      prisma.passwordReset.updateMany({
        where: { userId: user.id, consumed: false },
        data: { consumed: true },
      }),
      prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } }),
    ]);
  }
  return { message: PASSWORD_RESET_MESSAGE };
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  if (reset === null) {
    throw new AppError(
      'BAD_REQUEST',
      'Password reset token is invalid or expired. Request a new password reset token.',
    );
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordReset.updateMany({
      where: { id: reset.id, consumed: false, expiresAt: { gt: now } },
      data: { consumed: true },
    });
    if (claimed.count !== 1) {
      throw new AppError(
        'BAD_REQUEST',
        'Password reset token is invalid or expired. Request a new password reset token.',
      );
    }
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    await tx.refreshToken.updateMany({
      where: { userId: reset.userId, revokedAt: null },
      data: { revokedAt: now },
    });
  });
  return { message: 'Password reset successfully. Please log in again.' };
}
