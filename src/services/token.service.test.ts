import { createHash } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/config';
import { AppError } from '@/middlewares';

const prismaMock = vi.hoisted(() => ({
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@/services', () => ({ prisma: prismaMock }));

import {
  generateAccessToken,
  generateRefreshToken,
  issueTokenPair,
  revokeAllUserTokens,
  revokeRefreshToken,
  revokeRefreshTokenByValue,
  verifyAccessToken,
  verifyRefreshToken,
} from './token.service';

const user = { id: 'user-1', role: 'ARTIST' as const };
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.refreshToken.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 'rt-1', revokedAt: null, createdAt: new Date(), ...data }),
  );
  prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('generateAccessToken / verifyAccessToken', () => {
  it('signs an HS256 JWT carrying sub and role', async () => {
    const token = await generateAccessToken(user);
    const decoded = jwt.decode(token, { complete: true });
    expect(decoded?.header.alg).toBe('HS256');
    expect(decoded?.payload).toMatchObject({ sub: 'user-1', role: 'ARTIST' });
  });

  it('round-trips through verifyAccessToken', async () => {
    const token = await generateAccessToken(user);
    expect(verifyAccessToken(token)).toEqual({ sub: 'user-1', role: 'ARTIST' });
  });

  it('sets an expiry matching the configured TTL', async () => {
    const token = await generateAccessToken(user);
    const payload = jwt.decode(token) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(15 * 60);
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers();
    const token = await generateAccessToken(user);
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(() => verifyAccessToken(token)).toThrow('Access token expired');
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ sub: 'user-1', role: 'ADMIN' }, 'some-other-secret-value');
    expect(() => verifyAccessToken(forged)).toThrow('Invalid access token');
  });

  it('rejects a tampered payload', async () => {
    const [header, , signature] = (await generateAccessToken(user)).split('.');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-1', role: 'ADMIN' })).toString(
      'base64url',
    );
    expect(() => verifyAccessToken(`${header}.${payload}.${signature}`)).toThrow(AppError);
  });

  it('rejects malformed input with a 401 AppError', () => {
    try {
      verifyAccessToken('not-a-jwt');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });
});

describe('refresh token storage', () => {
  it('stores only the SHA-256 hash of the raw token', async () => {
    const result = await generateRefreshToken(user);

    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result.refreshTokenId).toBe('rt-1');
    const { data } = prismaMock.refreshToken.create.mock.calls[0]![0];
    expect(data.userId).toBe('user-1');
    expect(data.token).toBe(sha256(result.refreshToken));
    expect(data.token).not.toBe(result.refreshToken);
  });

  it('expires after the configured number of days', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const result = await generateRefreshToken(user);
    expect(result.refreshTokenExpiresAt).toEqual(
      new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
    );
  });

  it('issues unique tokens on every call', async () => {
    const [a, b] = await Promise.all([generateRefreshToken(user), generateRefreshToken(user)]);
    expect(a.refreshToken).not.toBe(b.refreshToken);
  });

  it('issueTokenPair returns a verifiable access token plus a refresh token', async () => {
    const pair = await issueTokenPair(user);
    expect(verifyAccessToken(pair.accessToken).sub).toBe('user-1');
    expect(pair.accessTokenExpiresIn).toBe(env.accessTokenTtl);
    expect(pair.refreshToken).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyRefreshToken', () => {
  const record = (overrides: Record<string, unknown> = {}) => ({
    id: 'rt-1',
    userId: 'user-1',
    token: sha256('raw'),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  });

  it('looks up the token by its hash and returns the owner', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(record());
    await expect(verifyRefreshToken('raw')).resolves.toEqual({
      refreshTokenId: 'rt-1',
      sub: 'user-1',
    });
    expect(prismaMock.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { token: sha256('raw') },
    });
  });

  it('rejects an unknown token', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(null);
    await expect(verifyRefreshToken('raw')).rejects.toThrow('Invalid or expired refresh token');
  });

  it('rejects a revoked token', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(record({ revokedAt: new Date() }));
    await expect(verifyRefreshToken('raw')).rejects.toThrow(AppError);
  });

  it('rejects an expired token', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(
      record({ expiresAt: new Date(Date.now() - 1) }),
    );
    await expect(verifyRefreshToken('raw')).rejects.toThrow(AppError);
  });
});

describe('revocation', () => {
  it('revokeRefreshToken only touches the active token with that id', async () => {
    await revokeRefreshToken('rt-1');
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'rt-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokeAllUserTokens revokes every active token for the user', async () => {
    await revokeAllUserTokens('user-1');
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('does not revoke a refresh token outside the authenticated user scope', async () => {
    await revokeRefreshTokenByValue('user-1', 'raw');

    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { token: sha256('raw'), userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
