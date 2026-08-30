import { INestApplication } from '@nestjs/common';
import {
  AssetType,
  CommissionStatus,
  PaymentStatus,
  Role,
  UserStatus,
} from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthHelper } from './helpers/auth.helper';
import {
  createTestApp,
  TestApp,
  stellarServiceMock,
} from './helpers/e2e-test-app';

describe('Payment workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let artistId: string;
  let artistToken: string;
  let clientToken: string;
  let commissionId: string;

  beforeAll(async () => {
    const ctx: TestApp = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;

    await prisma.asset.create({
      data: { code: 'XLM', type: AssetType.CRYPTO, isDefault: true },
    });
    await prisma.exchangeRate.create({
      data: { fromAsset: 'USDC', toAsset: 'XLM', rate: 1 },
    });

    const artistEmail = `payment-artist-${suffix}@example.com`;
    const clientEmail = `payment-client-${suffix}@example.com`;

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        name: 'Payment Artist',
        email: artistEmail,
        password: 'Password123!',
        role: Role.ARTIST,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        name: 'Payment Client',
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
    artistToken = AuthHelper.generateJWT(artistId, artistEmail, Role.ARTIST);
    clientToken = AuthHelper.generateJWT(client.id, clientEmail, Role.CLIENT);

    const { publicKey } = AuthHelper.createStellarKeypair();
    await request(app.getHttpServer())
      .post('/v1/wallet/connect')
      .set('Authorization', `Bearer ${artistToken}`)
      .send({ publicKey })
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/v1/commissions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        artistUserId: artistId,
        title: 'Escrow-backed commission',
        description: 'Paid via Stellar escrow',
        budgetUsdc: 100,
        deadline: '2030-01-01T00:00:00.000Z',
      })
      .expect(201);
    commissionId = created.body.data.id as string;

    await request(app.getHttpServer())
      .patch(`/v1/commissions/${commissionId}/accept`)
      .set('Authorization', `Bearer ${artistToken}`)
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('initiates escrow and returns an unsigned XDR for signing', async () => {
    const { publicKey } = AuthHelper.createStellarKeypair();

    const res = await request(app.getHttpServer())
      .post(`/v1/payments/commissions/${commissionId}/escrow`)
      .send({ amount: 100, assetCode: 'XLM', clientWallet: publicKey })
      .expect(201);

    expect(res.body.status).toBe('success');
    expect(res.body.data.paymentId).toBeDefined();
    expect(res.body.data.unsignedXdr).toBe('AAAA-test-unsigned-escrow-xdr');
    expect(res.body.data.amount).toBe(100);
    expect(res.body.data.assetCode).toBe('XLM');
    expect(res.body.data.platformFee).toBe(2);

    const payment = await prisma.payment.findUnique({
      where: { id: res.body.data.paymentId },
    });
    expect(payment).not.toBeNull();
    expect(payment!.status).toBe(PaymentStatus.PENDING);
  });

  it('rejects escrow initiation for an unsupported asset (400)', async () => {
    const { publicKey } = AuthHelper.createStellarKeypair();

    const res = await request(app.getHttpServer())
      .post(`/v1/payments/commissions/${commissionId}/escrow`)
      .send({ amount: 100, assetCode: 'DOGE', clientWallet: publicKey })
      .expect(400);
    expect(res.body.status).toBe('error');
  });

  it('confirms the payment and moves the commission to IN_PROGRESS', async () => {
    const pending = await prisma.payment.findFirst({
      where: { commissionId, status: PaymentStatus.PENDING },
    });
    expect(pending).not.toBeNull();

    const res = await request(app.getHttpServer())
      .post('/v1/payments/confirm')
      .send({ paymentId: pending!.id, signedXdr: 'AAAA-test-signed-xdr' })
      .expect(200);

    expect(res.body.data.paymentId).toBe(pending!.id);
    expect(res.body.data.txHash).toBe('mock-tx-hash');
    expect(res.body.data.status).toBe(PaymentStatus.SUBMITTED);

    const commission = await prisma.commission.findUnique({
      where: { id: commissionId },
    });
    expect(commission!.status).toBe(CommissionStatus.IN_PROGRESS);
  });

  it('rejects confirming a payment that is not pending (400)', async () => {
    const submitted = await prisma.payment.findFirst({
      where: { commissionId },
    });

    const res = await request(app.getHttpServer())
      .post('/v1/payments/confirm')
      .send({ paymentId: submitted!.id, signedXdr: 'AAAA-test-signed-xdr' })
      .expect(400);
    expect(res.body.status).toBe('error');
  });

  it('rejects release before the commission is COMPLETED (400)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/payments/commissions/${commissionId}/release`)
      .expect(400);
    expect(res.body.status).toBe('error');
  });

  it('releases escrowed funds to the artist after completion', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/commissions/${commissionId}/submit`)
      .set('Authorization', `Bearer ${artistToken}`)
      .send({ deliverableUrls: ['https://example.com/final.zip'] })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/v1/commissions/${commissionId}/approve`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    // Simulate the PaymentVerificationService cron flipping SUBMITTED -> CONFIRMED.
    const payment = await prisma.payment.findFirst({
      where: { commissionId },
    });
    expect(payment).not.toBeNull();
    await prisma.payment.update({
      where: { id: payment!.id },
      data: { status: PaymentStatus.CONFIRMED, txHash: 'verified-tx-hash' },
    });

    const res = await request(app.getHttpServer())
      .post(`/v1/payments/commissions/${commissionId}/release`)
      .expect(200);

    expect(res.body.data.status).toBe(PaymentStatus.RELEASED);
    expect(res.body.data.txHash).toBe('release-tx-hash');
    expect(res.body.data.netAmount).toBe(98);
    expect(res.body.data.assetCode).toBe('XLM');

    expect(stellarServiceMock.releaseFundsOnChain).toHaveBeenCalled();

    const notification = await prisma.notification.findFirst({
      where: { userId: artistId, type: 'PAYMENT_RELEASED' },
    });
    expect(notification).not.toBeNull();
  });
});
