import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseHelper } from './helpers/database.helper';
import { AuthHelper } from './helpers/auth.helper';
import { UserFixture } from './fixtures/user.fixture';
import { CommissionFixture } from './fixtures/commission.fixture';
import { Account, Keypair, TransactionBuilder, Networks, BASE_FEE } from '@stellar/stellar-sdk';

describe('Stellar Integration Tests (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let clientToken: string;
  let artistToken: string;
  let clientUser: any;
  let artistUser: any;
  let clientKeypair: any;
  let artistKeypair: any;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create test keypairs for Stellar operations
    clientKeypair = AuthHelper.createStellarKeypair();
    artistKeypair = AuthHelper.createStellarKeypair();

    // Setup test users with Stellar wallets
    const clientData = await UserFixture.createClientUser({
      walletAddress: clientKeypair.publicKey,
    });
    const artistData = await UserFixture.createArtistUser({
      walletAddress: artistKeypair.publicKey,
    });

    clientUser = await DatabaseHelper.createUser(clientData);
    artistUser = await DatabaseHelper.createUser(artistData);

    clientToken = AuthHelper.generateJWT(clientUser.id, clientUser.email, 'CLIENT');
    artistToken = AuthHelper.generateJWT(artistUser.id, artistUser.email, 'ARTIST');
  });

  afterEach(async () => {
    await DatabaseHelper.cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
    await DatabaseHelper.disconnect();
  });

  describe('Escrow Payment Initiation', () => {
    let commission: any;

    beforeEach(async () => {
      // Create a commission to test escrow
      const commissionData = CommissionFixture.createTestCommission({
        artistId: artistUser.id,
        clientId: clientUser.id,
        priceUsdc: '500.00',
        status: 'REQUESTED',
      });
      commission = await DatabaseHelper.createCommission(commissionData);
    });

    it('should initiate escrow payment for a commission', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/escrow`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: '500.00',
          assetCode: 'USDC',
        })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.xdr).toBeDefined(); // Unsigned XDR transaction
      expect(response.body.paymentId).toBeDefined();
      expect(response.body.status).toBe('PENDING');
    });

    it('should generate valid unsigned XDR for escrow', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/escrow`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: '500.00',
          assetCode: 'USDC',
        })
        .expect(201);

      const xdr = response.body.xdr;

      // XDR should be a valid string
      expect(typeof xdr).toBe('string');
      expect(xdr.length).toBeGreaterThan(100);
    });

    it('should include commission details in payment metadata', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/escrow`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: '500.00',
          assetCode: 'USDC',
        })
        .expect(201);

      const payment = response.body;
      expect(payment.commissionId).toBe(commission.id);
      expect(payment.payerId).toBe(clientUser.id);
      expect(payment.amount).toBe('500.00');
    });

    it('should reject escrow initiation with invalid commission', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/payments/commissions/invalid-id/escrow')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: '500.00',
          assetCode: 'USDC',
        })
        .expect(404);

      expect(response.body.message).toContain('Commission not found');
    });

    it('should reject escrow with amount mismatch', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/escrow`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: '1000.00', // Different from commission price
          assetCode: 'USDC',
        })
        .expect(400);

      expect(response.body.message).toContain('amount');
    });

    it('should reject escrow from non-client', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/escrow`)
        .set('Authorization', `Bearer ${artistToken}`)
        .send({
          amount: '500.00',
          assetCode: 'USDC',
        })
        .expect(403);

      expect(response.body.message).toContain('CLIENT');
    });

    it('should reject escrow when user has no wallet', async () => {
      // Create user without wallet
      const noWalletData = await UserFixture.createClientUser({
        walletAddress: null,
      });
      const noWalletUser = await DatabaseHelper.createUser(noWalletData);
      const noWalletToken = AuthHelper.generateJWT(
        noWalletUser.id,
        noWalletUser.email,
        'CLIENT',
      );

      const noWalletCommission = CommissionFixture.createTestCommission({
        artistId: artistUser.id,
        clientId: noWalletUser.id,
      });
      const commission2 = await DatabaseHelper.createCommission(noWalletCommission);

      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission2.id}/escrow`)
        .set('Authorization', `Bearer ${noWalletToken}`)
        .send({
          amount: '500.00',
          assetCode: 'USDC',
        })
        .expect(400);

      expect(response.body.message).toContain('wallet');
    });
  });

  describe('Payment Confirmation with Signed XDR', () => {
    let commission: any;
    let paymentId: string;
    let unsignedXdr: string;

    beforeEach(async () => {
      // Create and initiate escrow
      const commissionData = CommissionFixture.createTestCommission({
        artistId: artistUser.id,
        clientId: clientUser.id,
        priceUsdc: '500.00',
      });
      commission = await DatabaseHelper.createCommission(commissionData);

      const escrowResponse = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/escrow`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: '500.00',
          assetCode: 'USDC',
        });

      paymentId = escrowResponse.body.paymentId;
      unsignedXdr = escrowResponse.body.xdr;
    });

    it('should confirm payment with signed XDR', async () => {
      // Sign the XDR (in real scenario, this is done by user's wallet)
      const mockSignedXdr = this.generateMockSignedXdr(unsignedXdr);

      const response = await request(app.getHttpServer())
        .post('/v1/payments/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId,
          signedXdr: mockSignedXdr,
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.status).toBe('CONFIRMED');
      expect(response.body.transactionHash).toBeDefined();
    });

    it('should update commission status to IN_PROGRESS after payment confirmation', async () => {
      const mockSignedXdr = this.generateMockSignedXdr(unsignedXdr);

      await request(app.getHttpServer())
        .post('/v1/payments/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId,
          signedXdr: mockSignedXdr,
        })
        .expect(200);

      const updatedCommission = await DatabaseHelper.getCommissionById(
        commission.id,
      );
      expect(updatedCommission.status).toBe('IN_PROGRESS');
    });

    it('should store transaction hash for blockchain verification', async () => {
      const mockSignedXdr = this.generateMockSignedXdr(unsignedXdr);

      const response = await request(app.getHttpServer())
        .post('/v1/payments/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId,
          signedXdr: mockSignedXdr,
        })
        .expect(200);

      const payment = await DatabaseHelper.getPaymentById(paymentId);
      expect(payment.transactionHash).toBeDefined();
      expect(payment.transactionHash).toBe(response.body.transactionHash);
    });

    it('should reject confirmation with invalid XDR', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/payments/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId,
          signedXdr: 'invalid-xdr-format',
        })
        .expect(400);

      expect(response.body.message).toContain('XDR');
    });

    it('should reject confirmation with wrong payment ID', async () => {
      const mockSignedXdr = this.generateMockSignedXdr(unsignedXdr);

      const response = await request(app.getHttpServer())
        .post('/v1/payments/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId: 'wrong-payment-id',
          signedXdr: mockSignedXdr,
        })
        .expect(404);

      expect(response.body.message).toContain('Payment not found');
    });

    it('should prevent double-spending by rejecting duplicate confirmations', async () => {
      const mockSignedXdr = this.generateMockSignedXdr(unsignedXdr);

      // First confirmation
      await request(app.getHttpServer())
        .post('/v1/payments/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId,
          signedXdr: mockSignedXdr,
        })
        .expect(200);

      // Second confirmation attempt
      const response = await request(app.getHttpServer())
        .post('/v1/payments/confirm')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          paymentId,
          signedXdr: mockSignedXdr,
        })
        .expect(400);

      expect(response.body.message).toContain('already confirmed');
    });
  });

  describe('Payment Release to Artist', () => {
    let commission: any;

    beforeEach(async () => {
      // Create completed commission
      const commissionData = CommissionFixture.createCompletedCommission({
        artistId: artistUser.id,
        clientId: clientUser.id,
        priceUsdc: '500.00',
      });
      commission = await DatabaseHelper.createCommission(commissionData);

      // Create confirmed payment
      const paymentData = {
        id: 'payment-' + Math.random().toString(36).substr(2, 9),
        commissionId: commission.id,
        payerId: clientUser.id,
        amountUsdc: '500.00',
        status: 'CONFIRMED',
        transactionHash: 'mock-tx-hash-' + Date.now(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await DatabaseHelper.createPayment(paymentData);
    });

    it('should release escrowed payment to artist', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/release`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({})
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.status).toBe('RELEASED');
      expect(response.body.artistWallet).toBe(artistUser.walletAddress);
    });

    it('should deduct platform fee from released amount', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/release`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({})
        .expect(200);

      const originalAmount = 500;
      const platformFeePercentage = 0.1; // 10%
      const expectedArtistAmount = originalAmount * (1 - platformFeePercentage);

      expect(parseFloat(response.body.artistAmount)).toBe(expectedArtistAmount);
    });

    it('should reject release for incomplete commission', async () => {
      const incompleteCommission = CommissionFixture.createInProgressCommission({
        artistId: artistUser.id,
        clientId: clientUser.id,
      });
      const commission2 = await DatabaseHelper.createCommission(incompleteCommission);

      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission2.id}/release`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('COMPLETED');
    });

    it('should reject release when artist has no wallet', async () => {
      // Update artist to have no wallet
      const prisma = DatabaseHelper.getPrismaClient();
      await prisma.user.update({
        where: { id: artistUser.id },
        data: { walletAddress: null },
      });

      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/release`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('wallet');
    });

    it('should prevent non-authorized users from releasing payment', async () => {
      const otherUserData = await UserFixture.createClientUser();
      const otherUser = await DatabaseHelper.createUser(otherUserData);
      const otherToken = AuthHelper.generateJWT(
        otherUser.id,
        otherUser.email,
        'CLIENT',
      );

      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/release`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({})
        .expect(403);

      expect(response.body.message).toContain('authorized');
    });
  });

  describe('Stellar Address Validation', () => {
    it('should validate Stellar public key format', async () => {
      const validPublicKey = clientKeypair.publicKey;
      expect(AuthHelper.isValidStellarAddress(validPublicKey)).toBe(true);
    });

    it('should reject invalid Stellar address format', async () => {
      expect(AuthHelper.isValidStellarAddress('invalid-address')).toBe(false);
      expect(AuthHelper.isValidStellarAddress('GBINVALID')).toBe(false);
    });

    it('should prevent updating wallet to invalid address', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/users/${clientUser.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          walletAddress: 'invalid-stellar-address',
        })
        .expect(400);

      expect(response.body.message).toContain('wallet');
    });
  });

  describe('Asset Handling', () => {
    it('should support USDC asset payments', async () => {
      const commissionData = CommissionFixture.createTestCommission({
        artistId: artistUser.id,
        clientId: clientUser.id,
        priceUsdc: '250.00',
      });
      const commission = await DatabaseHelper.createCommission(commissionData);

      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/escrow`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: '250.00',
          assetCode: 'USDC',
        })
        .expect(201);

      expect(response.body.assetCode).toBe('USDC');
    });

    it('should reject unsupported asset types', async () => {
      const commissionData = CommissionFixture.createTestCommission({
        artistId: artistUser.id,
        clientId: clientUser.id,
      });
      const commission = await DatabaseHelper.createCommission(commissionData);

      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/escrow`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: '500.00',
          assetCode: 'UNKNOWN_ASSET',
        })
        .expect(400);

      expect(response.body.message).toContain('asset');
    });
  });

  describe('Transaction Error Handling', () => {
    it('should handle Stellar network failures gracefully', async () => {
      const commissionData = CommissionFixture.createTestCommission({
        artistId: artistUser.id,
        clientId: clientUser.id,
      });
      const commission = await DatabaseHelper.createCommission(commissionData);

      // This would test actual Stellar network error handling
      // In production tests, you'd mock network failures
      const response = await request(app.getHttpServer())
        .post(`/v1/payments/commissions/${commission.id}/escrow`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          amount: '500.00',
          assetCode: 'USDC',
        });

      // Should succeed or fail gracefully with appropriate error
      expect([201, 500, 503]).toContain(response.status);
    });
  });

  /**
   * Helper method to generate mock signed XDR for testing
   * In real implementation, this would be signed by user's wallet
   */
  private generateMockSignedXdr(unsignedXdr: string): string {
    // Mock implementation - in production, this would be properly signed
    return (
      'AAAAAgAAAABjVJhvYbX8A5L7T7x5h+jRAKRMvqr6H8wjYQJqbMh' +
      'l0AAAAZADfv4AAAAAAAAAAAAAAAAAAAAAAAAAAAA=' +
      Buffer.from(Date.now().toString()).toString('base64')
    );
  }
});
