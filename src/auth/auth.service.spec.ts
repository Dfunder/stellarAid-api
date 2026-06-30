import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

interface FauxUser {
  _id: { toString: () => string };
  fullName: string;
  email: string;
  isVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  save: jest.Mock;
}

describe('AuthService.register', () => {
  let auth: AuthService;
  let users: jest.Mocked<Pick<UsersService, 'findByEmail' | 'create'>>;
  let mail: jest.Mocked<Pick<MailService, 'sendVerificationEmail'>>;

  beforeEach(async () => {
    users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    mail = {
      sendVerificationEmail: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: mail },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    auth = moduleRef.get(AuthService);
  });

  it('creates a user, generates a verification token, and emails it', async () => {
    users.findByEmail.mockResolvedValue(null);
    const fauxUser: FauxUser = {
      _id: { toString: () => 'user-id-1' },
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      isVerified: false,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      save: jest.fn(async function (this: FauxUser) {
        return this;
      }),
    };
    users.create.mockResolvedValue(
      fauxUser as unknown as Awaited<ReturnType<UsersService['create']>>,
    );

    const result = await auth.register({
      fullName: 'Ada Lovelace',
      email: 'ADA@example.com  ',
      password: 'superSecret123',
    });

    expect(result.id).toBe('user-id-1');
    expect(result.email).toBe('ada@example.com');
    expect(result.fullName).toBe('Ada Lovelace');
    expect(result.isVerified).toBe(false);

    expect(users.findByEmail).toHaveBeenCalledWith('ada@example.com');
    expect(users.create).toHaveBeenCalledWith({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'superSecret123',
    });

    expect(fauxUser.emailVerificationToken).toMatch(/^[a-f0-9]{64}$/);
    expect(fauxUser.emailVerificationExpires).toBeInstanceOf(Date);
    expect(fauxUser.save).toHaveBeenCalledTimes(1);

    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@example.com',
        name: 'Ada Lovelace',
        token: fauxUser.emailVerificationToken,
      }),
    );
  });

  it('throws ConflictException when email is already registered', async () => {
    users.findByEmail.mockResolvedValue({
      _id: 'existing',
    } as unknown as Awaited<ReturnType<UsersService['findByEmail']>>);

    await expect(
      auth.register({
        fullName: 'Existing User',
        email: 'existing@example.com',
        password: 'whatever123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(users.create).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('still returns success when email delivery fails (logged warning)', async () => {
    users.findByEmail.mockResolvedValue(null);
    const fauxUser: FauxUser = {
      _id: { toString: () => 'user-id-2' },
      fullName: 'Bob',
      email: 'bob@example.com',
      isVerified: false,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      save: jest.fn(async function (this: FauxUser) {
        return this;
      }),
    };
    users.create.mockResolvedValue(
      fauxUser as unknown as Awaited<ReturnType<UsersService['create']>>,
    );
    mail.sendVerificationEmail.mockRejectedValue(new Error('SMTP down'));

    const result = await auth.register({
      fullName: 'Bob',
      email: 'bob@example.com',
      password: 'superSecret123',
    });
    expect(result.email).toBe('bob@example.com');
  });
});

describe('AuthService.resetPassword', () => {
  let auth: AuthService;
  let users: jest.Mocked<
    Pick<UsersService, 'findByPasswordResetToken' | 'update'>
  >;

  const RAW_TOKEN = 'a'.repeat(64);
  const HASHED_TOKEN = crypto.createHash('sha256').update(RAW_TOKEN).digest('hex');

  function fauxUserWithActiveReset(_id: string) {
    return {
      _id: { toString: () => _id },
      password: 'old-hash',
      passwordResetExpires: new Date(Date.now() + 60_000),
    };
  }

  beforeEach(async () => {
    users = {
      findByPasswordResetToken: jest.fn(),
      update: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    auth = moduleRef.get(AuthService);
  });

  it('hashes the incoming token, hashes the new password, and clears reset+refresh state', async () => {
    users.findByPasswordResetToken.mockResolvedValue(
      fauxUserWithActiveReset('user-1') as unknown as Awaited<
        ReturnType<UsersService['findByPasswordResetToken']>
      >,
    );
    users.update.mockResolvedValue(
      fauxUserWithActiveReset('user-1') as unknown as Awaited<
        ReturnType<UsersService['update']>
      >,
    );

    await auth.resetPassword(RAW_TOKEN, 'completelyNewPass1!');

    // The lookup must use the SHA-256 digest, never the raw token.
    expect(users.findByPasswordResetToken).toHaveBeenCalledTimes(1);
    expect(users.findByPasswordResetToken).toHaveBeenCalledWith(HASHED_TOKEN);

    // The update must persist the bcrypt-hashed new password and clear
    // every token-bearing field so previously active sessions die.
    expect(users.update).toHaveBeenCalledTimes(1);
    const [updateId, updateArg] = users.update.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(updateId).toBe('user-1');
    expect(updateArg.password).not.toBe('completelyNewPass1!');
    expect(typeof updateArg.password).toBe('string');
    expect((updateArg.password as string).startsWith('$2')).toBe(true);
    expect(updateArg.passwordResetToken).toBeNull();
    expect(updateArg.passwordResetExpires).toBeNull();
    expect(updateArg.refreshTokenHash).toBeNull();
    expect(updateArg.refreshTokenExpires).toBeNull();
  });

  it('rejects an unknown token without touching the user', async () => {
    users.findByPasswordResetToken.mockResolvedValue(null);

    await expect(
      auth.resetPassword(RAW_TOKEN, 'completelyNewPass1!'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(users.update).not.toHaveBeenCalled();
  });

  it('rejects an expired token without touching the user', async () => {
    users.findByPasswordResetToken.mockResolvedValue({
      _id: { toString: () => 'user-2' },
      password: 'old-hash',
      passwordResetExpires: new Date(Date.now() - 1),
    } as unknown as Awaited<ReturnType<UsersService['findByPasswordResetToken']>>);

    await expect(
      auth.resetPassword(RAW_TOKEN, 'completelyNewPass1!'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(users.update).not.toHaveBeenCalled();
  });

  it('emits the same generic message for invalid and expired tokens', async () => {
    users.findByPasswordResetToken.mockResolvedValue(null);
    const unknownMessage = await auth
      .resetPassword(RAW_TOKEN, 'completelyNewPass1!')
      .catch((err: Error) => err.message);

    users.findByPasswordResetToken.mockResolvedValue({
      _id: { toString: () => 'user-3' },
      password: 'old-hash',
      passwordResetExpires: new Date(Date.now() - 1000),
    } as unknown as Awaited<ReturnType<UsersService['findByPasswordResetToken']>>);
    const expiredMessage = await auth
      .resetPassword(RAW_TOKEN, 'completelyNewPass1!')
      .catch((err: Error) => err.message);

    expect(unknownMessage).toBe(expiredMessage);
  });

});
