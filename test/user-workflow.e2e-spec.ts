import { INestApplication } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthHelper } from './helpers/auth.helper';
import { createTestApp, TestApp } from './helpers/e2e-test-app';

describe('User workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `user-${suffix}@example.com`;
  const password = 'Password123!';
  let userId: string;
  let artistToken: string;

  beforeAll(async () => {
    const ctx: TestApp = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new artist account (201 + verification email message)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name: 'Test Artist', email, password, role: Role.ARTIST })
      .expect(201);

    expect(res.body.status).toBe('success');
    expect(res.body.data.message).toBe('Verification email sent');

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.status).toBe(UserStatus.PENDING_VERIFICATION);
    userId = user!.id;
    artistToken = AuthHelper.generateJWT(userId, email, Role.ARTIST);
  });

  it('rejects duplicate registration with 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name: 'Test Artist', email, password, role: Role.ARTIST })
      .expect(409);

    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('already exists');
  });

  it('rejects registration with a weak password (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        name: 'Bad Password',
        email: `bad-${suffix}@example.com`,
        password: 'weak',
        role: Role.ARTIST,
      })
      .expect(400);

    expect(res.body.status).toBe('error');
  });

  it('rejects login while the account is pending verification (401)', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(401);
  });

  it('rejects login with an invalid password (401)', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'WrongPassword123!' })
      .expect(401);
  });

  it('logs in after the account is activated and returns an access token', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });

    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('connects a Stellar wallet to the account', async () => {
    const { publicKey } = AuthHelper.createStellarKeypair();

    const res = await request(app.getHttpServer())
      .post('/v1/wallet/connect')
      .set('Authorization', `Bearer ${artistToken}`)
      .send({ publicKey })
      .expect(200);

    expect(res.body.data.walletAddress).toBe(publicKey);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user!.walletAddress).toBe(publicKey);
  });

  it('rejects an invalid Stellar public key (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/wallet/connect')
      .set('Authorization', `Bearer ${artistToken}`)
      .send({ publicKey: 'not-a-valid-key' })
      .expect(400);

    expect(res.body.status).toBe('error');
  });

  it('rejects protected routes without a valid token', async () => {
    await request(app.getHttpServer())
      .post('/v1/wallet/connect')
      .send({ publicKey: AuthHelper.createStellarKeypair().publicKey })
      .expect(401);
  });

  it('creates an artist profile and updates it', async () => {
    await prisma.artist.create({ data: { userId, skills: [] } });

    const me = await request(app.getHttpServer())
      .get('/v1/profile/me')
      .set('Authorization', `Bearer ${artistToken}`)
      .expect(200);
    expect(me.body.data.userId).toBe(userId);

    const updated = await request(app.getHttpServer())
      .patch('/v1/profile/me')
      .set('Authorization', `Bearer ${artistToken}`)
      .send({
        bio: 'Professional logo designer',
        tagline: 'Design is my passion',
        skills: ['Logo Design', 'Branding'],
      })
      .expect(200);
    expect(updated.body.data.bio).toBe('Professional logo designer');
    expect(updated.body.data.skills).toEqual(['Logo Design', 'Branding']);

    const artist = await prisma.artist.findUnique({ where: { userId } });
    expect(artist).not.toBeNull();

    const pub = await request(app.getHttpServer())
      .get(`/v1/profile/${artist!.id}`)
      .expect(200);
    expect(pub.body.data.id).toBe(artist!.id);
  });
});
