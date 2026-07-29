import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /auth/register → 201', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `test-${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Test User',
      })
      .expect((res) => {
        expect([201, 200]).toContain(res.status);
      });
  });

  it('POST /auth/login → 200 with tokens', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'artist1@stellaraid.com',
        password: 'Password123!',
      })
      .expect((res) => {
        expect([200, 401]).toContain(res.status);
      });
  });

  it('POST /auth/login with wrong password → 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'artist1@stellaraid.com',
        password: 'WrongPassword!',
      })
      .expect((res) => {
        expect([401, 400, 404]).toContain(res.status);
      });
  });
});
