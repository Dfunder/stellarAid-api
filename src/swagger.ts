/**
 * OpenAPI 3 documentation.
 *
 * Base spec (info, servers, security schemes, reusable schema components) is
 * defined inline; per-endpoint details come from JSDoc `@openapi` annotations
 * in the route files scanned below. The UI is served at `/api/docs`.
 */

import { join } from 'node:path';
import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '@/config';

function toGlob(path: string): string {
  return path.replace(/\\/g, '/');
}

export const openApiSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Lumora Services API (v1)',
      version: '1.0.0',
      description:
        'Backend API for the Lumora creative marketplace. All endpoints are served under `/api/v1`; ' +
        'authentication uses a Bearer access token with refresh-token rotation.',
      contact: { name: 'Lumora Services' },
    },
    // Paths in route annotations are absolute (e.g. `/api/v1/auth/login`), so
    // the server root is `/` — otherwise "Try it out" would double the prefix.
    servers: [{ url: '/', description: `This server (${env.nodeEnv})` }],
    tags: [
      { name: 'Auth', description: 'Registration, login, sessions and the current user.' },
      { name: 'Users', description: 'User profile management.' },
      { name: 'Artworks', description: 'Artwork CRUD, publishing, and view tracking.' },
      { name: 'Marketplace', description: 'Browsing and discovering published artworks.' },
      { name: 'Search', description: 'Full-text search across artworks.' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token from `/api/v1/auth/login` or `/api/v1/auth/register`.',
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing, invalid or expired access token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Access token expired' },
              },
            },
          },
        },
        ValidationFailed: {
          description: 'Request validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationError' },
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Request validation failed.',
                  fields: [
                    {
                      path: 'body.email',
                      message: 'Must be a valid email address.',
                      code: 'invalid_format',
                    },
                  ],
                },
              },
            },
          },
        },
        RateLimited: {
          description: 'Too many requests (auth routes: 10/min per IP)',
          headers: {
            'Retry-After': {
              description: 'Seconds to wait before retrying.',
              schema: { type: 'integer', example: 60 },
            },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'RATE_LIMITED',
                  message: 'Too many authentication attempts. Please try again later.',
                },
              },
            },
          },
        },
      },
      schemas: {
        PublicUser: {
          type: 'object',
          required: ['id', 'name', 'username', 'email', 'role', 'emailVerified'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Ada Lovelace' },
            username: { type: 'string', example: 'ada_1a2b3c' },
            email: { type: 'string', format: 'email', example: 'ada@example.com' },
            role: { type: 'string', enum: ['USER', 'ARTIST', 'ADMIN'] },
            emailVerified: { type: 'boolean' },
            bio: { type: 'string', nullable: true },
            location: { type: 'string', nullable: true },
            website: { type: 'string', format: 'uri', nullable: true },
            socialLinks: {
              type: 'object',
              nullable: true,
              additionalProperties: { type: 'string', format: 'uri' },
              example: { twitter: 'https://twitter.com/ada' },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PublicUserResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/PublicUser' },
          },
        },
        TokenPair: {
          type: 'object',
          required: ['accessToken', 'accessTokenExpiresIn', 'refreshToken', 'refreshTokenId'],
          properties: {
            accessToken: { type: 'string', description: 'JWT; send as `Bearer <token>`.' },
            accessTokenExpiresIn: { type: 'string', example: '15m' },
            refreshToken: { type: 'string', description: 'Opaque, single-use refresh token.' },
            refreshTokenId: { type: 'string', format: 'uuid' },
            refreshTokenExpiresAt: { type: 'string', format: 'date-time' },
          },
        },
        SessionResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/PublicUser' },
                tokens: { $ref: '#/components/schemas/TokenPair' },
              },
            },
          },
        },
        Wallet: {
          type: 'object',
          properties: {
            publicKey: {
              type: 'string',
              example: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
            },
            network: { type: 'string', example: 'testnet' },
            verified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ArtistProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            bio: { type: 'string', nullable: true },
            location: { type: 'string', nullable: true },
            hourlyRate: { type: 'string', nullable: true, example: '45.00' },
            availability: { type: 'boolean' },
            skills: { nullable: true },
            socialLinks: { nullable: true },
            coverImage: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            verified: { type: 'boolean' },
            verificationStatus: { type: 'string', example: 'PENDING' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CurrentUser: {
          allOf: [
            { $ref: '#/components/schemas/PublicUser' },
            {
              type: 'object',
              properties: {
                wallets: { type: 'array', items: { $ref: '#/components/schemas/Wallet' } },
                artistProfile: {
                  allOf: [{ $ref: '#/components/schemas/ArtistProfile' }],
                  nullable: true,
                },
              },
            },
          ],
        },
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', maxLength: 120, example: 'Ada Lovelace' },
            email: { type: 'string', format: 'email', example: 'ada@example.com' },
            password: {
              type: 'string',
              minLength: 8,
              maxLength: 128,
              description: 'Must contain a lowercase and an uppercase letter.',
              example: 'Password123',
            },
            role: { type: 'string', enum: ['USER', 'ARTIST'], default: 'USER' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'ada@example.com' },
            password: { type: 'string', example: 'Password123' },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', description: 'Refresh token from a TokenPair.' },
          },
        },
        UpdateProfileRequest: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: {
            name: { type: 'string', maxLength: 120, example: 'Ada L.' },
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 30,
              pattern: '^[a-z0-9_]+$',
              example: 'ada_lovelace',
            },
            bio: { type: 'string', maxLength: 1000, nullable: true, example: 'Mathematician.' },
            location: { type: 'string', maxLength: 120, nullable: true, example: 'London' },
            website: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'https://ada.dev',
            },
            socialLinks: {
              type: 'object',
              nullable: true,
              additionalProperties: { type: 'string', format: 'uri' },
              example: { github: 'https://github.com/ada' },
            },
          },
        },
        Artwork: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            category: { type: 'string', example: 'DIGITAL_PAINTING' },
            tags: { nullable: true },
            coverMediaId: { type: 'string', format: 'uuid', nullable: true },
            price: { type: 'string', nullable: true, example: '120.00' },
            asset: { type: 'string', enum: ['USDC', 'XLM'], nullable: true },
            published: { type: 'boolean' },
            sold: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ArtworkResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/Artwork' },
          },
        },
        ArtworkListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { type: 'array', items: { $ref: '#/components/schemas/Artwork' } },
          },
        },
        ArtworkPageResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                items: { type: 'array', items: { $ref: '#/components/schemas/Artwork' } },
                nextCursor: { type: 'string', nullable: true },
              },
            },
          },
        },
        CreateArtworkRequest: {
          type: 'object',
          required: ['title', 'category'],
          properties: {
            title: { type: 'string', maxLength: 200 },
            description: { type: 'string', maxLength: 5000 },
            category: { type: 'string', example: 'DIGITAL_PAINTING' },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 30 },
            price: { type: 'number', minimum: 0 },
            asset: { type: 'string', enum: ['USDC', 'XLM'] },
          },
        },
        UpdateArtworkRequest: {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 200 },
            description: { type: 'string', maxLength: 5000 },
            category: { type: 'string', example: 'DIGITAL_PAINTING' },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 30 },
            price: { type: 'number', minimum: 0 },
            asset: { type: 'string', enum: ['USDC', 'XLM'] },
          },
        },
        RecentlyViewedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      title: { type: 'string' },
                      category: { type: 'string' },
                      coverMediaId: { type: 'string', format: 'uuid', nullable: true },
                    },
                  },
                },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
              },
            },
          },
        },
        Health: {
          type: 'object',
          required: ['status', 'uptime', 'timestamp'],
          properties: {
            status: { type: 'string', enum: ['ok'] },
            uptime: { type: 'number', description: 'Process uptime in seconds.' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', example: 'NOT_FOUND' },
                message: { type: 'string' },
                details: { description: 'Optional structured context.' },
              },
            },
          },
        },
        ValidationError: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: {
              type: 'object',
              required: ['code', 'message', 'fields'],
              properties: {
                code: { type: 'string', enum: ['VALIDATION_ERROR'] },
                message: { type: 'string' },
                fields: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['path', 'message'],
                    properties: {
                      path: { type: 'string', example: 'body.email' },
                      message: { type: 'string' },
                      code: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  // Globs need forward slashes; `join` yields backslashes on Windows, which
  // silently matches nothing and leaves the spec without any paths.
  apis: [
    toGlob(join(__dirname, 'routes/**/*.routes.ts')),
    toGlob(join(__dirname, 'routes/**/*.routes.js')),
  ],
});
