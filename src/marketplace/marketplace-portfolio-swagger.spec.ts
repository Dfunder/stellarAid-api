import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { PortfolioController } from '../portfolio/portfolio.controller';
import { PortfolioService } from '../portfolio/portfolio.service';

describe('Marketplace & Portfolio OpenAPI / Swagger Documentation (Issue #750)', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MarketplaceController, PortfolioController],
      providers: [
        {
          provide: MarketplaceService,
          useValue: {
            createService: jest.fn(),
            findAllActive: jest.fn(),
            bulkCreateServices: jest.fn(),
            bulkUpdateServices: jest.fn(),
            bulkDeleteServices: jest.fn(),
            getBulkOperation: jest.fn(),
            search: jest.fn(),
            findOne: jest.fn(),
            findPortfolio: jest.fn(),
            getFeatured: jest.fn(),
            update: jest.fn(),
            deactivate: jest.fn(),
          },
        },
        {
          provide: PortfolioService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            trackView: jest.fn(),
            setVisibility: jest.fn(),
            remove: jest.fn(),
            addItem: jest.fn(),
            removeItem: jest.fn(),
            getAnalytics: jest.fn(),
          },
        },
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    const config = new DocumentBuilder()
      .setTitle('Lumora API')
      .setDescription('Lumora Creative Marketplace API')
      .setVersion('1.0')
      .addTag('marketplace', 'Creative marketplace service listings and discovery')
      .addTag('portfolio', 'Artist portfolio management and media items')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          in: 'header',
        },
        'bearer',
      )
      .build();

    document = SwaggerModule.createDocument(app, config);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Portfolio OpenAPI Documentation', () => {
    it('documents GET /portfolios with pagination and filter parameters', () => {
      const getPortfolios = document.paths['/portfolios']?.get;
      expect(getPortfolios).toBeDefined();
      expect(getPortfolios?.tags).toContain('portfolio');
      expect(getPortfolios?.summary).toBe('List published portfolios');
      expect(getPortfolios?.responses['200']).toBeDefined();
      expect(getPortfolios?.responses['400']).toBeDefined();
    });

    it('documents GET /portfolios/{id} with path parameter and 404 response', () => {
      const getPortfolio = document.paths['/portfolios/{id}']?.get;
      expect(getPortfolio).toBeDefined();
      expect(getPortfolio?.summary).toBe('Get a single portfolio with its items');
      expect(getPortfolio?.responses['200']).toBeDefined();
      expect(getPortfolio?.responses['404']).toBeDefined();
    });

    it('documents POST /portfolios with Bearer security, 201, 401, and 403 responses', () => {
      const postPortfolio = document.paths['/portfolios']?.post;
      expect(postPortfolio).toBeDefined();
      expect(postPortfolio?.summary).toBe('Create a portfolio (artist only)');
      expect(postPortfolio?.security).toEqual(expect.arrayContaining([{ bearer: [] }]));
      expect(postPortfolio?.responses['201']).toBeDefined();
      expect(postPortfolio?.responses['400']).toBeDefined();
      expect(postPortfolio?.responses['401']).toBeDefined();
      expect(postPortfolio?.responses['403']).toBeDefined();
    });

    it('documents PATCH /portfolios/{id}/publish with Bearer auth and status codes', () => {
      const patchPublish = document.paths['/portfolios/{id}/publish']?.patch;
      expect(patchPublish).toBeDefined();
      expect(patchPublish?.security).toEqual(expect.arrayContaining([{ bearer: [] }]));
      expect(patchPublish?.responses['200']).toBeDefined();
      expect(patchPublish?.responses['401']).toBeDefined();
      expect(patchPublish?.responses['403']).toBeDefined();
      expect(patchPublish?.responses['404']).toBeDefined();
    });

    it('documents POST /portfolios/{id}/items with Bearer auth and media item schema', () => {
      const postItem = document.paths['/portfolios/{id}/items']?.post;
      expect(postItem).toBeDefined();
      expect(postItem?.security).toEqual(expect.arrayContaining([{ bearer: [] }]));
      expect(postItem?.responses['201']).toBeDefined();
      expect(postItem?.responses['401']).toBeDefined();
      expect(postItem?.responses['403']).toBeDefined();
    });

    it('documents GET /portfolios/{id}/analytics with Bearer auth and analytics response', () => {
      const getAnalytics = document.paths['/portfolios/{id}/analytics']?.get;
      expect(getAnalytics).toBeDefined();
      expect(getAnalytics?.security).toEqual(expect.arrayContaining([{ bearer: [] }]));
      expect(getAnalytics?.responses['200']).toBeDefined();
      expect(getAnalytics?.responses['401']).toBeDefined();
      expect(getAnalytics?.responses['403']).toBeDefined();
    });
  });

  describe('Marketplace OpenAPI Documentation', () => {
    it('documents POST /marketplace/services with Bearer security and artist role', () => {
      const postService = document.paths['/marketplace/services']?.post;
      expect(postService).toBeDefined();
      expect(postService?.tags).toContain('marketplace');
      expect(postService?.security).toEqual(expect.arrayContaining([{ bearer: [] }]));
      expect(postService?.responses['201']).toBeDefined();
      expect(postService?.responses['400']).toBeDefined();
      expect(postService?.responses['401']).toBeDefined();
      expect(postService?.responses['403']).toBeDefined();
    });

    it('documents GET /marketplace/services with pagination query params', () => {
      const getServices = document.paths['/marketplace/services']?.get;
      expect(getServices).toBeDefined();
      expect(getServices?.summary).toBe('Browse all active services');
      expect(getServices?.responses['200']).toBeDefined();
    });

    it('documents GET /marketplace/services/search with comprehensive filter queries', () => {
      const search = document.paths['/marketplace/services/search']?.get;
      expect(search).toBeDefined();
      expect(search?.summary).toBe('Search and filter services');
      expect(search?.responses['200']).toBeDefined();
      expect(search?.responses['400']).toBeDefined();
    });

    it('documents bulk operations with Bearer security', () => {
      const bulkCreate = document.paths['/marketplace/services/bulk']?.post;
      expect(bulkCreate?.security).toEqual(expect.arrayContaining([{ bearer: [] }]));
      expect(bulkCreate?.responses['201']).toBeDefined();
      expect(bulkCreate?.responses['401']).toBeDefined();
      expect(bulkCreate?.responses['403']).toBeDefined();
    });

    it('documents PATCH /marketplace/services/{id} and DELETE with Bearer auth and 401/403/404', () => {
      const patch = document.paths['/marketplace/services/{id}']?.patch;
      const del = document.paths['/marketplace/services/{id}']?.delete;
      expect(patch?.security).toEqual(expect.arrayContaining([{ bearer: [] }]));
      expect(patch?.responses['200']).toBeDefined();
      expect(patch?.responses['401']).toBeDefined();
      expect(del?.security).toEqual(expect.arrayContaining([{ bearer: [] }]));
      expect(del?.responses['200']).toBeDefined();
      expect(del?.responses['401']).toBeDefined();
    });
  });
});
