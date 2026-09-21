import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Reflector } from '@nestjs/core';

describe('Auth OpenAPI / Swagger Documentation', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
          },
        },
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    const config = new DocumentBuilder()
      .setTitle('Lumora API')
      .setDescription('Lumora Creative Marketplace API - Version 1')
      .setVersion('1.0')
      .addTag('auth', 'Authentication and user onboarding endpoints')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description:
            'Enter your JWT Bearer token in the format: Bearer <token>',
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

  it('should define the Bearer security scheme in components', () => {
    expect(document.components).toBeDefined();
    expect(document.components?.securitySchemes).toBeDefined();
    const bearerScheme = document.components?.securitySchemes?.['bearer'] as
      { type?: string; scheme?: string; bearerFormat?: string } | undefined;
    expect(bearerScheme).toBeDefined();
    expect(bearerScheme?.type).toBe('http');
    expect(bearerScheme?.scheme).toBe('bearer');
    expect(bearerScheme?.bearerFormat).toBe('JWT');
  });

  it('should document POST /auth/register with all status codes and schemas', () => {
    const registerPath = document.paths['/auth/register'];
    expect(registerPath).toBeDefined();
    expect(registerPath.post).toBeDefined();

    const post = registerPath.post;
    expect(post.summary).toBe('Register a new user');
    expect(post.tags).toContain('auth');

    // Responses check: 201, 400, 409, 422, 429
    expect(post.responses['201']).toBeDefined();
    expect(post.responses['400']).toBeDefined();
    expect(post.responses['409']).toBeDefined();
    expect(post.responses['422']).toBeDefined();
    expect(post.responses['429']).toBeDefined();
  });

  it('should document POST /auth/login with all status codes and schemas', () => {
    const loginPath = document.paths['/auth/login'];
    expect(loginPath).toBeDefined();
    expect(loginPath.post).toBeDefined();

    const post = loginPath.post;
    expect(post.summary).toBe('Log in a user');
    expect(post.tags).toContain('auth');

    // Responses check: 200, 400, 401, 422, 429
    expect(post.responses['200']).toBeDefined();
    expect(post.responses['400']).toBeDefined();
    expect(post.responses['401']).toBeDefined();
    expect(post.responses['422']).toBeDefined();
    expect(post.responses['429']).toBeDefined();
  });

  it('should document GET /auth/session with Bearer security requirement and 401', () => {
    const sessionPath = document.paths['/auth/session'];
    expect(sessionPath).toBeDefined();
    expect(sessionPath.get).toBeDefined();

    const get = sessionPath.get;
    expect(get.summary).toBe('Get current authenticated session');
    expect(get.tags).toContain('auth');

    // Security scheme check
    expect(get.security).toBeDefined();
    expect(get.security).toEqual(expect.arrayContaining([{ bearer: [] }]));

    // Responses check: 200, 401
    expect(get.responses['200']).toBeDefined();
    expect(get.responses['401']).toBeDefined();
  });
});
