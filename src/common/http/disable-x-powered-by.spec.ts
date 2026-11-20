import express from 'express';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { disableXPoweredBy } from './disable-x-powered-by';

function fakeApp(instance: unknown): INestApplication {
  return {
    getHttpAdapter: () => ({ getInstance: () => instance }),
  } as unknown as INestApplication;
}

describe('disableXPoweredBy', () => {
  it('removes the X-Powered-By header from responses', async () => {
    const server = express();
    server.get('/', (_req, res) => {
      res.json({ ok: true });
    });

    const before = await request(server).get('/');
    expect(before.headers['x-powered-by']).toBe('Express');

    disableXPoweredBy(fakeApp(server));

    const after = await request(server).get('/');
    expect(after.headers['x-powered-by']).toBeUndefined();
  });

  it('does not throw when the adapter has no disable()', () => {
    expect(() => disableXPoweredBy(fakeApp({}))).not.toThrow();
  });
});
