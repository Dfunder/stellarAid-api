import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src';
import { configureApp } from './../src/app.setup';

describe('AppController (e2e)', () => {
  let app: INestApplication<App> | undefined;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('/api/v1 (GET)', () => {
    return request(app!.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/v1/admin/analytics (GET) fails closed', () => {
    return request(app!.getHttpServer())
      .get('/api/v1/admin/analytics')
      .expect(401);
  });

  it('serves Swagger UI and documents the active routes', async () => {
    await request(app!.getHttpServer())
      .get('/api/v1/docs')
      .expect(200)
      .expect('Content-Type', /html/);

    const response = await request(app!.getHttpServer())
      .get('/api/v1/docs-json')
      .expect(200);

    expect(response.body).toMatchObject({
      paths: {
        '/api/v1': {
          get: {
            responses: {
              '200': {
                description: 'The current API greeting.',
                content: {
                  'application/json': {
                    schema: { type: 'string', example: 'Hello World!' },
                  },
                },
              },
            },
          },
        },
        '/api/v1/admin/analytics': {
          get: {
            responses: {
              '401': {
                description:
                  'Admin authentication and authorization are not configured.',
              },
            },
          },
        },
      },
    });
  });

  it('returns descriptive liveness metadata', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'stellaraid-api',
      version: '0.0.1',
    });
    expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns descriptive readiness metadata', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'stellaraid-api',
      checks: {
        database: 'not-configured',
        redis: 'not-configured',
      },
    });
  });

  it('returns service version metadata', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/version')
      .expect(200);

    expect(response.body).toMatchObject({
      name: 'stellarAid-api',
      version: '0.0.1',
    });
  });

  it('rejects JSON payloads larger than the configured limit', async () => {
    await request(app!.getHttpServer())
      .post('/api/v1')
      .set('Content-Type', 'application/json')
      .send({ payload: 'x'.repeat(1_100_000) })
      .expect(413)
      .expect(({ body }) => {
        expect(body).toMatchObject({ statusCode: 413 });
      });
  });
});
