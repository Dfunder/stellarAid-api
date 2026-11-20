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

  it('/nonexistent-route (GET) should return 404', () => {
    return request(app.getHttpServer())
      .get('/nonexistent-route')
      .expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
