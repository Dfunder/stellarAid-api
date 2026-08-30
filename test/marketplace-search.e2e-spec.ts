import { INestApplication } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthHelper } from './helpers/auth.helper';
import { createTestApp, TestApp } from './helpers/e2e-test-app';

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priceUsdc: number;
  deliveryDays: number;
  isActive: boolean;
}

interface SearchResponse {
  status: string;
  data: { data: ServiceItem[]; meta: { total: number } };
}

describe('Marketplace search (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let artistToken: string;
  const createdTitles: string[] = [];

  const search = async (query: string): Promise<SearchResponse> => {
    const res = await request(app.getHttpServer())
      .get(`/v1/marketplace/services/search${query}`)
      .expect(200);
    return res.body as SearchResponse;
  };

  beforeAll(async () => {
    const ctx: TestApp = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;

    const artistEmail = `search-artist-${suffix}@example.com`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        name: 'Search Artist',
        email: artistEmail,
        password: 'Password123!',
        role: Role.ARTIST,
      })
      .expect(201);

    const artist = await prisma.user.update({
      where: { email: artistEmail },
      data: { status: UserStatus.ACTIVE },
    });
    await prisma.artist.create({ data: { userId: artist.id, skills: [] } });
    artistToken = AuthHelper.generateJWT(artist.id, artistEmail, Role.ARTIST);

    const services = [
      {
        title: 'Minimal Logo Design',
        description: 'Clean logo with vector source files',
        category: 'GRAPHIC_DESIGN',
        priceUsdc: 50,
        deliveryDays: 3,
        revisions: 3,
        features: ['Vector file', '3 concepts'],
      },
      {
        title: 'Brand Identity Package',
        description: 'Full brand kit including guidelines',
        category: 'BRANDING',
        priceUsdc: 200,
        deliveryDays: 10,
        revisions: 5,
        features: ['Logo', 'Stationery', 'Guidelines'],
      },
      {
        title: 'Mobile App UI Kit',
        description: 'Figma UI kit for mobile apps',
        category: 'UI_UX',
        priceUsdc: 120,
        deliveryDays: 5,
        revisions: 2,
        features: ['Figma file', 'Components'],
      },
    ];

    for (const service of services) {
      const res = await request(app.getHttpServer())
        .post('/v1/marketplace/services')
        .set('Authorization', `Bearer ${artistToken}`)
        .send(service)
        .expect(201);
      expect(res.body.status).toBe('success');
      createdTitles.push(res.body.data.title);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('browses all active services', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/marketplace/services')
      .expect(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.meta.total).toBeGreaterThanOrEqual(3);
  });

  it('searches services by keyword', async () => {
    const res = await search('?q=logo');
    expect(res.data.meta.total).toBeGreaterThanOrEqual(1);
    expect(res.data.data.some((s) => s.title.includes('Logo'))).toBe(true);
  });

  it('filters services by category', async () => {
    const res = await search('?category=BRANDING');
    expect(res.data.data).toHaveLength(1);
    expect(res.data.data[0].title).toBe('Brand Identity Package');
  });

  it('filters services by price range', async () => {
    const res = await search('?minPrice=100&maxPrice=200');
    const prices = res.data.data.map((s) => Number(s.priceUsdc));
    expect(prices.length).toBeGreaterThanOrEqual(2);
    expect(prices.every((p) => p >= 100 && p <= 200)).toBe(true);
  });

  it('filters services by max delivery days', async () => {
    const res = await search('?deliveryDays=5');
    expect(res.data.data.every((s) => s.deliveryDays <= 5)).toBe(true);
  });

  it('sorts results by price ascending', async () => {
    const res = await search('?sortBy=price-asc');
    const prices = res.data.data.map((s) => Number(s.priceUsdc));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('sorts results by price descending', async () => {
    const res = await search('?sortBy=price-desc');
    const prices = res.data.data.map((s) => Number(s.priceUsdc));
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it('paginates search results', async () => {
    const res = await search('?page=1&limit=2');
    expect(res.data.data).toHaveLength(2);
    expect(res.data.meta.total).toBeGreaterThanOrEqual(3);
  });

  it('no longer returns a deactivated service', async () => {
    const res = await search('?q=UI%20Kit');
    expect(res.data.meta.total).toBe(1);
    const service = res.data.data[0];

    await request(app.getHttpServer())
      .delete(`/v1/marketplace/services/${service.id}`)
      .set('Authorization', `Bearer ${artistToken}`)
      .expect(200);

    const after = await search('?q=UI%20Kit');
    expect(after.data.meta.total).toBe(0);
  });
});
