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
      .expect('Content-Type', /application\/json/)
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

  it('returns descriptive liveness metadata', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'stellaraid-api',
      version: '0.0.1',
    });
    expect((response.body as { timestamp: string }).timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
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

  it('/api/v1 (GET) returns an explicit JSON content type', () => {
    return request(app!.getHttpServer())
      .get('/api/v1')
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /application\/json/)
      .expect(({ body }) => {
        expect(body).toBe('Hello World!');
      });
  });

  describe('X-Powered-By', () => {
    it('is disabled on the Express instance, not only stripped by Helmet', () => {
      const instance = app!.getHttpAdapter().getInstance() as {
        get(setting: string): unknown;
      };
      expect(instance.get('x-powered-by')).toBe(false);
    });

    it('is not sent on success, error, or docs responses', async () => {
      const responses = [
        await request(app!.getHttpServer()).get('/api/v1').expect(200),
        await request(app!.getHttpServer()).get('/api/v1/missing').expect(404),
        await request(app!.getHttpServer())
          .get('/api/v1')
          .set('Accept', 'text/html')
          .expect(406),
        await request(app!.getHttpServer()).get('/api/v1/docs').expect(200),
      ];

      for (const response of responses) {
        expect(response.headers['x-powered-by']).toBeUndefined();
      }
    });
  });

  describe('security headers', () => {
    it('sets Helmet headers and a locked-down CSP on API responses', async () => {
      const response = await request(app!.getHttpServer())
        .get('/api/v1')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['cross-origin-resource-policy']).toBe(
        'cross-origin',
      );
      expect(response.headers['content-security-policy']).toContain(
        "default-src 'none'",
      );
      expect(response.headers['content-security-policy']).toContain(
        "frame-ancestors 'none'",
      );
    });

    it('sets the same headers on error responses', async () => {
      const notFound = await request(app!.getHttpServer())
        .get('/api/v1/missing')
        .expect(404);
      const notAcceptable = await request(app!.getHttpServer())
        .get('/api/v1')
        .set('Accept', 'text/html')
        .expect(406);

      for (const response of [notFound, notAcceptable]) {
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['content-security-policy']).toContain(
          "default-src 'none'",
        );
      }
    });

    it('uses a policy Swagger UI can run under on the docs pages', async () => {
      const response = await request(app!.getHttpServer())
        .get('/api/v1/docs')
        .expect(200);
      const csp = response.headers['content-security-policy'];

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain("default-src 'none'");
      expect(csp).not.toContain('upgrade-insecure-requests');

      // script-src 'self' blocks inline scripts, so the page must not use any.
      const scriptTags = response.text.match(/<script\b[^>]*>/gi) ?? [];
      expect(scriptTags.length).toBeGreaterThan(0);
      for (const tag of scriptTags) {
        expect(tag).toMatch(/\bsrc=/i);
      }
    });
  });
});
