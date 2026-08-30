import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseHelper } from './helpers/database.helper';
import { AuthHelper } from './helpers/auth.helper';
import { UserFixture } from './fixtures/user.fixture';
import * as bcrypt from 'bcrypt';

describe('Authentication Integration Tests (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await DatabaseHelper.cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
    await DatabaseHelper.disconnect();
  });

  describe('User Registration Flow', () => {
    it('should register a new user with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          password: 'SecurePassword123!',
        })
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.email).toBe('newuser@example.com');
      expect(response.body.message).toContain('verification email sent');
    });

    it('should reject registration with missing required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'incomplete@example.com',
          // missing name and password
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'invalid-email',
          name: 'User',
          password: 'SecurePassword123!',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'weakpass@example.com',
          name: 'User',
          password: '123', // Too weak
        })
        .expect(400);

      expect(response.body.message).toContain('password');
    });

    it('should prevent duplicate email registration', async () => {
      const email = `duplicate-${Date.now()}@example.com`;

      // First registration
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email,
          name: 'First User',
          password: 'SecurePassword123!',
        })
        .expect(201);

      // Second registration with same email
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email,
          name: 'Second User',
          password: 'SecurePassword123!',
        })
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should hash password before storing in database', async () => {
      const email = `hashtest-${Date.now()}@example.com`;
      const password = 'SecurePassword123!';

      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email,
          name: 'Hash Test User',
          password,
        })
        .expect(201);

      const user = await DatabaseHelper.getUserByEmail(email);
      expect(user).toBeDefined();
      expect(user.passwordHash).not.toBe(password);

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      expect(passwordMatches).toBe(true);
    });

    it('should rate limit registration attempts', async () => {
      // Attempt registration more than the rate limit (typically 3 per minute)
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/v1/auth/register')
            .send({
              email: `ratelimit-${i}-${Date.now()}@example.com`,
              name: 'User',
              password: 'SecurePassword123!',
            }),
        );
      }

      const responses = await Promise.all(promises);

      // At least one should be rate limited
      const rateLimited = responses.some((r) => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('User Login Flow', () => {
    let testUser: any;
    const testEmail = `login-test-${Date.now()}@example.com`;
    const testPassword = 'SecurePassword123!';

    beforeEach(async () => {
      // Create a test user
      const userData = await UserFixture.createTestUser({
        email: testEmail,
        password: testPassword,
      });
      testUser = await DatabaseHelper.createUser(userData);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testEmail);
    });

    it('should return valid JWT token on login', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      const token = response.body.accessToken;
      const decoded = AuthHelper.verifyJWT(token);

      expect(decoded).toBeDefined();
      expect(decoded.sub).toBe(testUser.id);
      expect(decoded.email).toBe(testEmail);
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with missing email', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          password: testPassword,
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject login with missing password', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testEmail,
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should rate limit login attempts', async () => {
      const promises = [];
      for (let i = 0; i < 8; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/v1/auth/login')
            .send({
              email: testEmail,
              password: 'WrongPassword',
            }),
        );
      }

      const responses = await Promise.all(promises);

      // At least one should be rate limited
      const rateLimited = responses.some((r) => r.status === 429);
      expect(rateLimited).toBe(true);
    });

    it('should prevent login with unverified email', async () => {
      const unverifiedUserData = await UserFixture.createUnverifiedUser({
        email: `unverified-${Date.now()}@example.com`,
      });
      await DatabaseHelper.createUser(unverifiedUserData);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: unverifiedUserData.email,
          password: 'TestPassword123!',
        })
        .expect(403);

      expect(response.body.message).toContain('not verified');
    });
  });

  describe('JWT Token Validation', () => {
    it('should accept requests with valid JWT token', async () => {
      const userData = await UserFixture.createTestUser();
      const user = await DatabaseHelper.createUser(userData);
      const token = AuthHelper.generateJWT(user.id, user.email);

      const response = await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.email).toBe(user.email);
    });

    it('should reject requests without JWT token', async () => {
      await request(app.getHttpServer())
        .get('/v1/users/me')
        .expect(401);
    });

    it('should reject requests with malformed JWT token', async () => {
      await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', 'Bearer invalid.token.format')
        .expect(401);
    });

    it('should reject requests with expired JWT token', async () => {
      const userData = await UserFixture.createTestUser();
      const user = await DatabaseHelper.createUser(userData);
      const expiredToken = AuthHelper.createExpiredTestToken(user.id);

      await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject requests with invalid JWT signature', async () => {
      const fakeToken = AuthHelper.generateJWT('user-id', 'user@example.com');
      const tamperedToken =
        fakeToken.slice(0, -5) + 'XXXXX'; // Tamper with signature

      await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);
    });

    it('should extract user information from valid JWT token', async () => {
      const userData = await UserFixture.createTestUser();
      const user = await DatabaseHelper.createUser(userData);
      const token = AuthHelper.generateJWT(user.id, user.email, 'ARTIST');

      const response = await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe(user.email);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow admin user to access admin endpoints', async () => {
      const adminData = await UserFixture.createAdminUser();
      const admin = await DatabaseHelper.createUser(adminData);
      const token = AuthHelper.generateJWT(admin.id, admin.email, 'ADMIN');

      await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should deny non-admin user from accessing admin endpoints', async () => {
      const userData = await UserFixture.createArtistUser();
      const user = await DatabaseHelper.createUser(userData);
      const token = AuthHelper.generateJWT(user.id, user.email, 'ARTIST');

      await request(app.getHttpServer())
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should allow client user to create commissions', async () => {
      const clientData = await UserFixture.createClientUser();
      const client = await DatabaseHelper.createUser(clientData);
      const token = AuthHelper.generateJWT(client.id, client.email, 'CLIENT');

      const response = await request(app.getHttpServer())
        .post('/v1/commissions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'New Commission',
          description: 'Description',
          priceUsdc: '500.00',
        })
        .expect(201);

      expect(response.body).toBeDefined();
    });
  });

  describe('Public Endpoints', () => {
    it('should allow access to auth register endpoint without token', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: `public-${Date.now()}@example.com`,
          name: 'Public User',
          password: 'SecurePassword123!',
        })
        .expect(201);

      expect(response.body).toBeDefined();
    });

    it('should allow access to auth login endpoint without token', async () => {
      const userData = await UserFixture.createTestUser({
        email: `public-login-${Date.now()}@example.com`,
      });
      await DatabaseHelper.createUser(userData);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: userData.email,
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
    });

    it('should allow access to public marketplace endpoints without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/marketplace')
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Account Security', () => {
    it('should enforce password complexity requirements', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: `weak-${Date.now()}@example.com`,
          name: 'User',
          password: 'weak', // Too weak - no uppercase, special chars, etc.
        })
        .expect(400);

      expect(response.body.message).toContain('password');
    });

    it('should prevent password reuse', async () => {
      const userData = await UserFixture.createTestUser({
        email: `nopasspersue-${Date.now()}@example.com`,
      });
      const user = await DatabaseHelper.createUser(userData);
      const token = AuthHelper.generateJWT(user.id, user.email);

      // Try to change password to same value
      const response = await request(app.getHttpServer())
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'TestPassword123!',
          newPassword: 'TestPassword123!', // Same as current
        })
        .expect(400);

      expect(response.body.message).toContain('cannot reuse');
    });

    it('should lock account after multiple failed login attempts', async () => {
      const userData = await UserFixture.createTestUser({
        email: `lockout-${Date.now()}@example.com`,
      });
      await DatabaseHelper.createUser(userData);

      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          request(app.getHttpServer())
            .post('/v1/auth/login')
            .send({
              email: userData.email,
              password: 'WrongPassword',
            }),
        );
      }

      const responses = await Promise.all(attempts);

      // Last response should indicate account is locked
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429 || 423); // Rate limited or locked
    });
  });
});
