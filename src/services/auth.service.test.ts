import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/middlewares';

const { prismaMock, tokenMock, passwordMock } = vi.hoisted(() => {
  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    emailVerification: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    prismaMock: prisma,
    tokenMock: {
      issueTokenPair: vi.fn(),
      revokeRefreshToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
    },
    passwordMock: {
      hashPassword: vi.fn(),
      comparePassword: vi.fn(),
    },
  };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));
vi.mock('./token.service', () => tokenMock);
vi.mock('@/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils')>()),
  ...passwordMock,
}));

import { loginUser, refreshSession, registerUser, toPublicUser } from './auth.service';

const storedUser = {
  id: 'user-1',
  email: 'ada@example.com',
  passwordHash: '$2b$12$hash',
  name: 'Ada',
  username: 'ada_abc123',
  role: 'USER' as const,
  emailVerified: false,
  bio: null,
  location: null,
  website: null,
  socialLinks: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};
const tokens = { accessToken: 'access', refreshToken: 'refresh' };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock),
  );
  tokenMock.issueTokenPair.mockResolvedValue(tokens);
  passwordMock.hashPassword.mockResolvedValue('$2b$12$hash');
});

describe('toPublicUser', () => {
  it('never exposes the password hash', () => {
    const publicUser = toPublicUser(storedUser);
    expect(publicUser).not.toHaveProperty('passwordHash');
    expect(publicUser).toMatchObject({ id: 'user-1', email: 'ada@example.com' });
  });
});

describe('registerUser', () => {
  it('hashes the password, lowercases the email and issues tokens', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(storedUser);

    const result = await registerUser({
      name: 'Ada',
      email: 'Ada@Example.com',
      password: 'Secret123',
      role: 'USER',
    });

    expect(passwordMock.hashPassword).toHaveBeenCalledWith('Secret123');
    const { data } = prismaMock.user.create.mock.calls[0]![0];
    expect(data.email).toBe('ada@example.com');
    expect(data.passwordHash).toBe('$2b$12$hash');
    expect(prismaMock.emailVerification.create).toHaveBeenCalledOnce();
    expect(result.tokens).toBe(tokens);
    expect(result.verificationToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email with CONFLICT', async () => {
    prismaMock.user.findUnique.mockResolvedValue(storedUser);
    await expect(
      registerUser({ name: 'Ada', email: 'ada@example.com', password: 'x', role: 'USER' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});

describe('loginUser', () => {
  it('returns the user and tokens for valid credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue(storedUser);
    passwordMock.comparePassword.mockResolvedValue(true);

    const result = await loginUser({ email: 'ADA@example.com', password: 'Secret123' });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@example.com' },
    });
    expect(passwordMock.comparePassword).toHaveBeenCalledWith('Secret123', '$2b$12$hash');
    expect(result.tokens).toBe(tokens);
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(storedUser);
    passwordMock.comparePassword.mockResolvedValue(false);
    const wrongPassword = loginUser({ email: 'ada@example.com', password: 'nope' });
    await expect(wrongPassword).rejects.toThrow('Invalid email or password');

    prismaMock.user.findUnique.mockResolvedValue(null);
    const unknownEmail = loginUser({ email: 'ghost@example.com', password: 'nope' });
    await expect(unknownEmail).rejects.toThrow('Invalid email or password');
  });
});

describe('refreshSession', () => {
  it('revokes the presented token and issues a new pair (rotation)', async () => {
    tokenMock.verifyRefreshToken.mockResolvedValue({ refreshTokenId: 'rt-1', sub: 'user-1' });
    prismaMock.user.findUnique.mockResolvedValue(storedUser);

    const result = await refreshSession('raw');

    expect(tokenMock.revokeRefreshToken).toHaveBeenCalledWith('rt-1');
    expect(tokenMock.issueTokenPair).toHaveBeenCalledWith({ id: 'user-1', role: 'USER' });
    expect(result.tokens).toBe(tokens);
  });

  it('propagates an invalid refresh token error without issuing tokens', async () => {
    tokenMock.verifyRefreshToken.mockRejectedValue(new AppError('UNAUTHORIZED', 'nope'));
    await expect(refreshSession('raw')).rejects.toBeInstanceOf(AppError);
    expect(tokenMock.issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects when the token owner no longer exists', async () => {
    tokenMock.verifyRefreshToken.mockResolvedValue({ refreshTokenId: 'rt-1', sub: 'gone' });
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(refreshSession('raw')).rejects.toThrow('Invalid or expired refresh token');
    expect(tokenMock.revokeRefreshToken).not.toHaveBeenCalled();
  });
});
