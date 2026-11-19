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

    app = moduleFixture.createNestApplication();
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
      .expect(({ body }) => {
        expect(body).toBe('Hello World!');
      });
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

  it('/api/v1 (GET) supports cache validation', async () => {
    const first = await request(app!.getHttpServer())
      .get('/api/v1')
      .expect(200);

    expect(first.headers['etag']).toBeDefined();
    expect(first.headers['cache-control']).toContain('public');

    await request(app!.getHttpServer())
      .get('/api/v1')
      .set('If-None-Match', first.headers['etag'])
      .expect(304);
  });

  it('missing routes include a machine-readable error code', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/missing')
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});
