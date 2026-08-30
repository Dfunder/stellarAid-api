import { INestApplication } from '@nestjs/common';
import { CommissionStatus, Role, UserStatus } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthHelper } from './helpers/auth.helper';
import { createTestApp, TestApp } from './helpers/e2e-test-app';

describe('Commission workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let artistId: string;
  let clientId: string;
  let artistToken: string;
  let clientToken: string;

  beforeAll(async () => {
    const ctx: TestApp = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;

    const artistEmail = `commission-artist-${suffix}@example.com`;
    const clientEmail = `commission-client-${suffix}@example.com`;

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        name: 'Commission Artist',
        email: artistEmail,
        password: 'Password123!',
        role: Role.ARTIST,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        name: 'Commission Client',
        email: clientEmail,
        password: 'Password123!',
        role: Role.CLIENT,
      })
      .expect(201);

    const artist = await prisma.user.update({
      where: { email: artistEmail },
      data: { status: UserStatus.ACTIVE },
    });
    const client = await prisma.user.update({
      where: { email: clientEmail },
      data: { status: UserStatus.ACTIVE },
    });
    await prisma.artist.create({ data: { userId: artist.id, skills: [] } });

    artistId = artist.id;
    clientId = client.id;
    artistToken = AuthHelper.generateJWT(artistId, artistEmail, Role.ARTIST);
    clientToken = AuthHelper.generateJWT(clientId, clientEmail, Role.CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a commission as a client (PENDING)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/commissions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        artistUserId: artistId,
        title: 'Custom logo design',
        description: 'Modern logo for a startup',
        budgetUsdc: 150,
        deadline: '2030-01-01T00:00:00.000Z',
      })
      .expect(201);

    expect(res.body.status).toBe('success');
    expect(res.body.data.status).toBe(CommissionStatus.PENDING);
    expect(res.body.data.clientId).toBe(clientId);
    expect(res.body.data.artistId).toBeDefined();
  });

  it('rejects a client creating a commission with a missing artist (404)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/commissions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        artistUserId: '00000000-0000-4000-8000-000000000000',
        title: 'Orphan commission',
        description: 'Should not exist',
        budgetUsdc: 10,
        deadline: '2030-01-01T00:00:00.000Z',
      })
      .expect(404);
    expect(res.body.status).toBe('error');
  });

  it('rejects a non-client creating a commission (403)', async () => {
    await request(app.getHttpServer())
      .post('/v1/commissions')
      .set('Authorization', `Bearer ${artistToken}`)
      .send({
        artistUserId: artistId,
        title: 'Not allowed',
        description: 'Artists cannot create commissions',
        budgetUsdc: 10,
        deadline: '2030-01-01T00:00:00.000Z',
      })
      .expect(403);
  });

  it('artist accepts the commission (ACCEPTED)', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/commissions')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const commission = body.data.data.find(
      (c: { status: string; artistId: string }) =>
        c.status === CommissionStatus.PENDING && c.artistId,
    );
    expect(commission).toBeDefined();
    const commissionId = commission.id as string;

    const accepted = await request(app.getHttpServer())
      .patch(`/v1/commissions/${commissionId}/accept`)
      .set('Authorization', `Bearer ${artistToken}`)
      .expect(200);
    expect(accepted.body.data.status).toBe(CommissionStatus.ACCEPTED);
  });

  it('rejects accept by the client (role mismatch, 403)', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/commissions')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const commission = body.data.data.find(
      (c: { status: string }) => c.status === CommissionStatus.ACCEPTED,
    );
    const commissionId = commission.id as string;

    await request(app.getHttpServer())
      .patch(`/v1/commissions/${commissionId}/accept`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);
  });

  it('artist submits deliverables (SUBMITTED)', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/commissions')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const commission = body.data.data.find(
      (c: { status: string }) => c.status === CommissionStatus.ACCEPTED,
    );
    const commissionId = commission.id as string;

    const submitted = await request(app.getHttpServer())
      .patch(`/v1/commissions/${commissionId}/submit`)
      .set('Authorization', `Bearer ${artistToken}`)
      .send({ deliverableUrls: ['https://example.com/deliverable.png'] })
      .expect(200);
    expect(submitted.body.data.status).toBe(CommissionStatus.SUBMITTED);
  });

  it('client approves the submitted work (COMPLETED)', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/commissions')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const commission = body.data.data.find(
      (c: { status: string }) => c.status === CommissionStatus.SUBMITTED,
    );
    const commissionId = commission.id as string;

    const approved = await request(app.getHttpServer())
      .patch(`/v1/commissions/${commissionId}/approve`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(approved.body.data.status).toBe(CommissionStatus.COMPLETED);
  });

  it('rejects an invalid status transition (400)', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/commissions')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const completed = body.data.data.find(
      (c: { status: string }) => c.status === CommissionStatus.COMPLETED,
    );
    const commissionId = completed.id as string;

    const res = await request(app.getHttpServer())
      .patch(`/v1/commissions/${commissionId}/submit`)
      .set('Authorization', `Bearer ${artistToken}`)
      .send({ deliverableUrls: ['https://example.com/again.png'] })
      .expect(400);
    expect(res.body.status).toBe('error');
  });

  it('a non-participant cannot view the commission (403)', async () => {
    const strangerEmail = `stranger-${suffix}@example.com`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        name: 'Stranger',
        email: strangerEmail,
        password: 'Password123!',
        role: Role.CLIENT,
      })
      .expect(201);
    const stranger = await prisma.user.update({
      where: { email: strangerEmail },
      data: { status: UserStatus.ACTIVE },
    });
    const strangerToken = AuthHelper.generateJWT(
      stranger.id,
      strangerEmail,
      Role.CLIENT,
    );

    const { body } = await request(app.getHttpServer())
      .get('/v1/commissions')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    const commissionId = body.data.data[0].id as string;

    await request(app.getHttpServer())
      .get(`/v1/commissions/${commissionId}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(403);
  });
});
