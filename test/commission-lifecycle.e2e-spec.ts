import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommissionStatus, PaymentStatus, Role, UserStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/sync/jwt.auth.guard';
import { RolesGuard } from '../src/auth/sync/roles.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { StellarService } from '../src/payments/stellar.service';

describe('Commission lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let artistId: string;
  let clientId: string;
  let artistToken: string;
  let clientToken: string;

  const stellarMock = {
    releaseFundsOnChain: jest.fn().mockResolvedValue({ txHash: 'release-tx-hash' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { headers: Record<string, string>; user?: unknown } } }) => {
          const requestContext = context.switchToHttp().getRequest();
          const token = requestContext.headers.authorization?.replace('Bearer ', '');
          requestContext.user = token === artistToken
            ? { sub: artistId, role: Role.ARTIST }
            : { sub: clientId, role: Role.CLIENT };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(StellarService)
      .useValue(stellarMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const artistEmail = `lifecycle-artist-${suffix}@example.com`;
    const clientEmail = `lifecycle-client-${suffix}@example.com`;

    await request(app.getHttpServer()).post('/auth/register').send({
      name: 'Lifecycle Artist',
      email: artistEmail,
      password: 'Password123!',
      role: Role.ARTIST,
    }).expect(201);
    await request(app.getHttpServer()).post('/auth/register').send({
      name: 'Lifecycle Client',
      email: clientEmail,
      password: 'Password123!',
      role: Role.CLIENT,
    }).expect(201);

    const artist = await prisma.user.update({
      where: { email: artistEmail },
      data: { status: UserStatus.ACTIVE, walletAddress: 'GARTISTLIFECYCLE' },
    });
    const client = await prisma.user.update({
      where: { email: clientEmail },
      data: { status: UserStatus.ACTIVE, walletAddress: 'GCLIENTLIFECYCLE' },
    });
    await prisma.artist.create({ data: { userId: artist.id, skills: [] } });

    artistId = artist.id;
    clientId = client.id;
    artistToken = 'artist-lifecycle-token';
    clientToken = 'client-lifecycle-token';
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers users, completes a commission, and emits payment release', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/commissions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        artistUserId: artistId,
        title: 'Lifecycle commission',
        description: 'End-to-end lifecycle test',
        budgetUsdc: 100,
        deadline: '2030-01-01T00:00:00.000Z',
      })
      .expect(201);
    const commissionId = createResponse.body.id as string;
    expect(createResponse.body.status).toBe(CommissionStatus.PENDING);

    const accepted = await request(app.getHttpServer())
      .patch(`/commissions/${commissionId}/accept`)
      .set('Authorization', `Bearer ${artistToken}`)
      .expect(200);
    expect(accepted.body.status).toBe(CommissionStatus.ACCEPTED);

    const submitted = await request(app.getHttpServer())
      .patch(`/commissions/${commissionId}/submit`)
      .set('Authorization', `Bearer ${artistToken}`)
      .send({ deliverableUrls: ['https://example.com/deliverable.png'] })
      .expect(200);
    expect(submitted.body.status).toBe(CommissionStatus.SUBMITTED);

    const approved = await request(app.getHttpServer())
      .patch(`/commissions/${commissionId}/approve`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    expect(approved.body.status).toBe(CommissionStatus.COMPLETED);

    const payment = await prisma.payment.create({
      data: {
        commissionId,
        clientWallet: 'GCLIENTLIFECYCLE',
        artistWallet: 'GARTISTLIFECYCLE',
        amountUsdc: 100,
        platformFeeUsdc: 2,
        assetCode: 'XLM',
        status: PaymentStatus.CONFIRMED,
      },
    });

    const released = await request(app.getHttpServer())
      .post(`/payments/commissions/${commissionId}/release`)
      .expect(200);
    expect(released.body).toMatchObject({
      paymentId: payment.id,
      txHash: 'release-tx-hash',
      status: PaymentStatus.RELEASED,
    });
    expect(stellarMock.releaseFundsOnChain).toHaveBeenCalledWith(
      'GARTISTLIFECYCLE',
      100,
      2,
      'XLM',
      commissionId,
    );

    await expect(prisma.notification.findFirst({
      where: { userId: artistId, type: 'PAYMENT_RELEASED' },
    })).resolves.toEqual(expect.objectContaining({ type: 'PAYMENT_RELEASED' }));
  });
});