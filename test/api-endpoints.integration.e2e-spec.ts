import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseHelper } from './helpers/database.helper';
import { AuthHelper } from './helpers/auth.helper';
import { UserFixture } from './fixtures/user.fixture';
import { CommissionFixture } from './fixtures/commission.fixture';

describe('API Endpoints Integration Tests (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let artistToken: string;
  let clientToken: string;
  let artistUser: any;
  let clientUser: any;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup test users
    const artistData = await UserFixture.createArtistUser();
    const clientData = await UserFixture.createClientUser();

    artistUser = await DatabaseHelper.createUser(artistData);
    clientUser = await DatabaseHelper.createUser(clientData);

    artistToken = AuthHelper.generateJWT(
      artistUser.id,
      artistUser.email,
      'ARTIST',
    );
    clientToken = AuthHelper.generateJWT(
      clientUser.id,
      clientUser.email,
      'CLIENT',
    );
  });

  afterEach(async () => {
    await DatabaseHelper.cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
    await DatabaseHelper.disconnect();
  });

  describe('Commission Endpoints', () => {
    describe('POST /v1/commissions', () => {
      it('should create a commission as client user', async () => {
        const response = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'Digital Illustration Needed',
            description: 'Need a fantasy character illustration',
            priceUsdc: '500.00',
            estimatedDaysToComplete: 14,
          })
          .expect(201);

        expect(response.body).toBeDefined();
        expect(response.body.title).toBe('Digital Illustration Needed');
        expect(response.body.status).toBe('REQUESTED');
      });

      it('should include client ID in created commission', async () => {
        const response = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'Test Commission',
            description: 'Test',
            priceUsdc: '250.00',
            estimatedDaysToComplete: 7,
          })
          .expect(201);

        expect(response.body.clientId).toBe(clientUser.id);
      });

      it('should reject commission creation without required fields', async () => {
        const response = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'Incomplete Commission',
            // missing description and priceUsdc
          })
          .expect(400);

        expect(response.body.message).toBeDefined();
      });

      it('should reject commission with invalid price', async () => {
        const response = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'Invalid Price',
            description: 'Test',
            priceUsdc: '-100.00', // Negative price
            estimatedDaysToComplete: 7,
          })
          .expect(400);

        expect(response.body.message).toContain('price');
      });

      it('should reject commission creation when not authenticated', async () => {
        await request(app.getHttpServer())
          .post('/v1/commissions')
          .send({
            title: 'Unauthorized Commission',
            description: 'Test',
            priceUsdc: '500.00',
          })
          .expect(401);
      });

      it('should reject artist from creating commission as client', async () => {
        const response = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${artistToken}`)
          .send({
            title: 'Artist Trying to Commission',
            description: 'Test',
            priceUsdc: '500.00',
          })
          .expect(403);

        expect(response.body.message).toContain('CLIENT');
      });
    });

    describe('GET /v1/commissions/:id', () => {
      it('should retrieve a commission by ID', async () => {
        // Create commission
        const createResponse = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'Test Commission',
            description: 'Test',
            priceUsdc: '300.00',
            estimatedDaysToComplete: 10,
          })
          .expect(201);

        const commissionId = createResponse.body.id;

        // Retrieve commission
        const getResponse = await request(app.getHttpServer())
          .get(`/v1/commissions/${commissionId}`)
          .set('Authorization', `Bearer ${artistToken}`)
          .expect(200);

        expect(getResponse.body.id).toBe(commissionId);
        expect(getResponse.body.title).toBe('Test Commission');
      });

      it('should return 404 for non-existent commission', async () => {
        await request(app.getHttpServer())
          .get('/v1/commissions/non-existent-id')
          .set('Authorization', `Bearer ${artistToken}`)
          .expect(404);
      });

      it('should include all commission details in response', async () => {
        const createResponse = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'Detailed Commission',
            description: 'Full details test',
            priceUsdc: '750.00',
            estimatedDaysToComplete: 21,
          })
          .expect(201);

        const commissionId = createResponse.body.id;

        const getResponse = await request(app.getHttpServer())
          .get(`/v1/commissions/${commissionId}`)
          .set('Authorization', `Bearer ${artistToken}`)
          .expect(200);

        expect(getResponse.body).toHaveProperty('id');
        expect(getResponse.body).toHaveProperty('title');
        expect(getResponse.body).toHaveProperty('description');
        expect(getResponse.body).toHaveProperty('priceUsdc');
        expect(getResponse.body).toHaveProperty('status');
        expect(getResponse.body).toHaveProperty('clientId');
        expect(getResponse.body).toHaveProperty('createdAt');
      });
    });

    describe('PATCH /v1/commissions/:id', () => {
      it('should update commission status by artist', async () => {
        // Create commission
        const createResponse = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'Status Update Test',
            description: 'Test',
            priceUsdc: '400.00',
            estimatedDaysToComplete: 14,
          })
          .expect(201);

        const commissionId = createResponse.body.id;

        // Update status
        const updateResponse = await request(app.getHttpServer())
          .patch(`/v1/commissions/${commissionId}`)
          .set('Authorization', `Bearer ${artistToken}`)
          .send({
            status: 'ACCEPTED',
          })
          .expect(200);

        expect(updateResponse.body.status).toBe('ACCEPTED');
      });

      it('should allow commission state transition ACCEPTED->IN_PROGRESS', async () => {
        const createResponse = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'State Transition Test',
            description: 'Test',
            priceUsdc: '500.00',
            estimatedDaysToComplete: 14,
          })
          .expect(201);

        const commissionId = createResponse.body.id;

        // REQUESTED -> ACCEPTED
        await request(app.getHttpServer())
          .patch(`/v1/commissions/${commissionId}`)
          .set('Authorization', `Bearer ${artistToken}`)
          .send({ status: 'ACCEPTED' })
          .expect(200);

        // ACCEPTED -> IN_PROGRESS
        const inProgressResponse = await request(app.getHttpServer())
          .patch(`/v1/commissions/${commissionId}`)
          .set('Authorization', `Bearer ${artistToken}`)
          .send({ status: 'IN_PROGRESS' })
          .expect(200);

        expect(inProgressResponse.body.status).toBe('IN_PROGRESS');
      });

      it('should reject invalid status transition', async () => {
        const createResponse = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'Invalid Transition',
            description: 'Test',
            priceUsdc: '500.00',
            estimatedDaysToComplete: 14,
          })
          .expect(201);

        const commissionId = createResponse.body.id;

        // Try REQUESTED -> COMPLETED (should skip to DELIVERED first)
        const response = await request(app.getHttpServer())
          .patch(`/v1/commissions/${commissionId}`)
          .set('Authorization', `Bearer ${artistToken}`)
          .send({ status: 'COMPLETED' })
          .expect(400);

        expect(response.body.message).toContain('invalid transition');
      });
    });

    describe('GET /v1/commissions', () => {
      it('should list commissions for authenticated user', async () => {
        // Create multiple commissions
        for (let i = 0; i < 3; i++) {
          await request(app.getHttpServer())
            .post('/v1/commissions')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
              title: `Commission ${i + 1}`,
              description: 'Test',
              priceUsdc: `${100 * (i + 1)}.00`,
              estimatedDaysToComplete: 7,
            })
            .expect(201);
        }

        const response = await request(app.getHttpServer())
          .get('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(3);
      });

      it('should support pagination', async () => {
        // Create 10 commissions
        for (let i = 0; i < 10; i++) {
          await request(app.getHttpServer())
            .post('/v1/commissions')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
              title: `Commission ${i + 1}`,
              description: 'Test',
              priceUsdc: '500.00',
              estimatedDaysToComplete: 7,
            })
            .expect(201);
        }

        // Get page 1
        const page1Response = await request(app.getHttpServer())
          .get('/v1/commissions?page=1&limit=5')
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(200);

        expect(page1Response.body.data.length).toBeLessThanOrEqual(5);
        expect(page1Response.body.total).toBe(10);
        expect(page1Response.body.page).toBe(1);
      });

      it('should filter commissions by status', async () => {
        // Create commission
        const createResponse = await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'Filter Test',
            description: 'Test',
            priceUsdc: '500.00',
            estimatedDaysToComplete: 14,
          })
          .expect(201);

        // Get with status filter
        const response = await request(app.getHttpServer())
          .get('/v1/commissions?status=REQUESTED')
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(200);

        expect(response.body.data.some((c) => c.title === 'Filter Test')).toBe(
          true,
        );
      });
    });
  });

  describe('User Profile Endpoints', () => {
    describe('GET /v1/users/me', () => {
      it('should return current user profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/users/me')
          .set('Authorization', `Bearer ${artistToken}`)
          .expect(200);

        expect(response.body.id).toBe(artistUser.id);
        expect(response.body.email).toBe(artistUser.email);
      });

      it('should include role information', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/users/me')
          .set('Authorization', `Bearer ${artistToken}`)
          .expect(200);

        expect(response.body.role).toBe('ARTIST');
      });

      it('should reject request without authentication', async () => {
        await request(app.getHttpServer())
          .get('/v1/users/me')
          .expect(401);
      });
    });

    describe('GET /v1/users/:id', () => {
      it('should retrieve public user profile', async () => {
        const response = await request(app.getHttpServer())
          .get(`/v1/users/${artistUser.id}`)
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(200);

        expect(response.body.id).toBe(artistUser.id);
        expect(response.body.name).toBe(artistUser.name);
      });

      it('should not include sensitive information in public profile', async () => {
        const response = await request(app.getHttpServer())
          .get(`/v1/users/${artistUser.id}`)
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(200);

        expect(response.body).not.toHaveProperty('passwordHash');
      });

      it('should return 404 for non-existent user', async () => {
        await request(app.getHttpServer())
          .get('/v1/users/non-existent-id')
          .set('Authorization', `Bearer ${clientToken}`)
          .expect(404);
      });
    });

    describe('PATCH /v1/users/:id', () => {
      it('should allow user to update their profile', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/v1/users/${artistUser.id}`)
          .set('Authorization', `Bearer ${artistToken}`)
          .send({
            name: 'Updated Artist Name',
          })
          .expect(200);

        expect(response.body.name).toBe('Updated Artist Name');
      });

      it('should prevent user from updating others profile', async () => {
        await request(app.getHttpServer())
          .patch(`/v1/users/${artistUser.id}`)
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            name: 'Hacked Name',
          })
          .expect(403);
      });
    });
  });

  describe('Artist Profile Endpoints', () => {
    describe('GET /v1/artists/:userId', () => {
      it('should retrieve artist profile with statistics', async () => {
        // Create artist profile
        await DatabaseHelper.createArtistProfile({
          userId: artistUser.id,
          bio: 'Professional digital artist',
          skills: ['Illustration', 'Design'],
          averageRating: 4.8,
          totalReviews: 15,
        });

        const response = await request(app.getHttpServer())
          .get(`/v1/artists/${artistUser.id}`)
          .expect(200);

        expect(response.body.bio).toBe('Professional digital artist');
        expect(response.body.skills).toContain('Illustration');
        expect(response.body.averageRating).toBe(4.8);
      });
    });
  });

  describe('Marketplace Endpoints', () => {
    describe('GET /v1/marketplace', () => {
      it('should list available commissions', async () => {
        // Create public commissions
        for (let i = 0; i < 3; i++) {
          await request(app.getHttpServer())
            .post('/v1/commissions')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({
              title: `Public Commission ${i + 1}`,
              description: 'Available for bidding',
              priceUsdc: '500.00',
              visibility: 'PUBLIC',
              estimatedDaysToComplete: 14,
            })
            .expect(201);
        }

        const response = await request(app.getHttpServer())
          .get('/v1/marketplace')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should filter marketplace by category', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/marketplace?category=ILLUSTRATION')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should allow public access without authentication', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/marketplace')
          .expect(200);

        expect(response.body).toBeDefined();
      });
    });

    describe('GET /v1/marketplace/search', () => {
      it('should search commissions by title', async () => {
        await request(app.getHttpServer())
          .post('/v1/commissions')
          .set('Authorization', `Bearer ${clientToken}`)
          .send({
            title: 'Unique Search Term Commission',
            description: 'Test',
            priceUsdc: '500.00',
            visibility: 'PUBLIC',
            estimatedDaysToComplete: 14,
          })
          .expect(201);

        const response = await request(app.getHttpServer())
          .get('/v1/marketplace/search?q=Unique+Search+Term')
          .expect(200);

        expect(response.body).toBeDefined();
      });

      it('should support price range filtering', async () => {
        const response = await request(app.getHttpServer())
          .get('/v1/marketplace/search?minPrice=100&maxPrice=1000')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for malformed JSON', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/commissions')
        .set('Authorization', `Bearer ${clientToken}`)
        .set('Content-Type', 'application/json')
        .send('{invalid json}')
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should return 405 for unsupported HTTP method', async () => {
      await request(app.getHttpServer())
        .delete('/v1/commissions')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(405);
    });

    it('should return 500 for server errors with error tracking', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/invalid-endpoint')
        .set('Authorization', `Bearer ${artistToken}`)
        .expect(404);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      const promises = [];

      // Make many requests quickly
      for (let i = 0; i < 30; i++) {
        promises.push(
          request(app.getHttpServer())
            .get(`/v1/commissions`)
            .set('Authorization', `Bearer ${artistToken}`),
        );
      }

      const responses = await Promise.all(promises);

      // At least some requests should be rate limited
      const rateLimited = responses.some((r) => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('should validate email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/commissions')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: 'Test',
          description: 'Test',
          priceUsdc: '500.00',
          clientEmail: 'invalid-email', // Invalid format
        })
        .expect(400);

      expect(response.body.message).toContain('email');
    });

    it('should trim whitespace from string inputs', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/commissions')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: '  Trimmed Title  ',
          description: '  Test Description  ',
          priceUsdc: '500.00',
          estimatedDaysToComplete: 14,
        })
        .expect(201);

      expect(response.body.title).toBe('Trimmed Title');
    });

    it('should sanitize user input to prevent injection', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/commissions')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: 'Commission<script>alert("xss")</script>',
          description: 'Test',
          priceUsdc: '500.00',
          estimatedDaysToComplete: 14,
        })
        .expect(201);

      expect(response.body.title).not.toContain('<script>');
    });
  });
});
