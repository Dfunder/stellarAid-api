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
      { name: 'Profiles', description: 'Artist profile management.' },
      { name: 'Portfolios', description: 'Artist portfolio items and their ordering.' },
      { name: 'Stats', description: 'Public, aggregate platform metrics.' },
      { name: 'Analytics', description: 'Product-analytics event ingestion.' },
      { name: 'Artworks', description: 'Artwork CRUD, publishing, view tracking, tags and saves.' },
      {
        name: 'Marketplace',
        description: 'Browsing, trending, featured and recommended artworks.',
      },
      { name: 'Search', description: 'Full-text search across published artworks.' },
      { name: 'Categories', description: 'Browsable category taxonomy.' },
      { name: 'Taxonomy', description: 'Browsable categories and the shared tag vocabulary.' },
      { name: 'Media', description: 'File uploads for artworks, portfolios and deliverables.' },
      { name: 'Orders', description: 'Artwork purchases and their payment state.' },
      {
        name: 'Commissions',
        description:
          'Commission requests and their status machine (PENDING → ACCEPTED → IN_PROGRESS → DELIVERED → COMPLETED, plus CANCELLED and DISPUTED).',
      },
      { name: 'Threads', description: '1:1 message threads and read receipts.' },
      { name: 'Reviews', description: 'Artist reviews, rating summaries and moderation.' },
      { name: 'Health', description: 'Liveness and readiness probes.' },
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
        PlatformStats: {
          type: 'object',
          properties: {
            totalUsers: { type: 'integer' },
            totalArtists: { type: 'integer' },
            totalArtworks: { type: 'integer' },
            totalSales: { type: 'integer', description: 'Count of COMPLETED orders.' },
            totalVolume: {
              type: 'string',
              description: 'Sum of COMPLETED order amounts.',
              example: '128450.00',
            },
          },
        },
        PlatformStatsResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/PlatformStats' },
          },
        },
        AnalyticsEvent: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: [
                'PAGE_VIEW',
                'ARTWORK_VIEW',
                'SAVE',
                'PURCHASE_START',
                'PURCHASE_COMPLETE',
                'COMMISSION_REQUEST',
              ],
            },
            userId: { type: 'string', format: 'uuid' },
            properties: {
              type: 'object',
              description: 'Must not contain PII keys (email, password, phone, etc.).',
              additionalProperties: true,
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        AnalyticsEventBatchRequest: {
          type: 'object',
          required: ['events'],
          properties: {
            events: {
              type: 'array',
              minItems: 1,
              maxItems: 100,
              items: { $ref: '#/components/schemas/AnalyticsEvent' },
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
        ArtworkOffsetPageResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                items: { type: 'array', items: { $ref: '#/components/schemas/Artwork' } },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: {
                  type: 'integer',
                  description: 'Omitted (not tracked) for search result pages.',
                },
              },
            },
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
        PresignUploadRequest: {
          type: 'object',
          required: ['type', 'mimeType', 'filename', 'size'],
          properties: {
            type: { type: 'string', enum: ['IMAGE', 'DIGITAL_FILE'] },
            mimeType: { type: 'string', example: 'image/png' },
            filename: { type: 'string', example: 'cover.png' },
            size: { type: 'integer', description: 'File size in bytes.', example: 204800 },
            parentType: { type: 'string', enum: ['ARTWORK', 'PORTFOLIO'] },
            parentId: { type: 'string', format: 'uuid' },
          },
        },
        PresignUploadResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                mediaId: { type: 'string', format: 'uuid' },
                uploadUrl: { type: 'string', format: 'uri' },
                key: { type: 'string' },
                expiresInSeconds: { type: 'integer', example: 300 },
              },
            },
          },
        },
        ArtworkDetailResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                artwork: { $ref: '#/components/schemas/Artwork' },
                mediaIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                relatedArtworks: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Artwork' },
                },
                reviewSummary: {
                  type: 'object',
                  description: "Aggregated from the owning artist's reviews.",
                  properties: {
                    averageRating: { type: 'number', nullable: true },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
        MediaVariant: {
          type: 'object',
          properties: {
            label: { type: 'string', example: 'thumbnail' },
            url: { type: 'string', format: 'uri' },
            width: { type: 'integer', nullable: true },
            height: { type: 'integer', nullable: true },
          },
        },
        MediaResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                type: { type: 'string', enum: ['IMAGE', 'DIGITAL_FILE'] },
                url: { type: 'string', format: 'uri' },
                mimeType: { type: 'string' },
                size: { type: 'string', description: 'Bytes, as a string (source is a BigInt).' },
                width: { type: 'integer', nullable: true },
                height: { type: 'integer', nullable: true },
                variants: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/MediaVariant' },
                },
                createdAt: { type: 'string', format: 'date-time' },
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
        PortfolioItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            tags: { nullable: true },
            coverMediaId: { type: 'string', format: 'uuid', nullable: true },
            order: { type: 'integer' },
            published: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            buyerId: { type: 'string', format: 'uuid' },
            sellerId: { type: 'string', format: 'uuid' },
            artworkId: { type: 'string', format: 'uuid' },
            amount: { type: 'string', example: '120.00' },
            asset: { type: 'string', enum: ['USDC', 'XLM'] },
            platformFee: { type: 'string', example: '6.00' },
            status: {
              type: 'string',
              enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'],
            },
            idempotencyKey: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateOrderRequest: {
          type: 'object',
          required: ['artworkId'],
          properties: {
            artworkId: { type: 'string', format: 'uuid' },
            idempotencyKey: {
              type: 'string',
              maxLength: 200,
              description: 'A repeated request with the same key returns the original order.',
            },
          },
        },
        OrderResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                order: { $ref: '#/components/schemas/Order' },
                total: {
                  type: 'string',
                  description: 'amount + platformFee, formatted to 2 decimal places.',
                  example: '126.00',
                },
              },
            },
          },
        },
        PortfolioItemResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/PortfolioItem' },
          },
        },
        PortfolioItemListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { type: 'array', items: { $ref: '#/components/schemas/PortfolioItem' } },
          },
        },
        CreatePortfolioItemRequest: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', maxLength: 200 },
            description: { type: 'string', maxLength: 5000 },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 30 },
          },
        },
        UpdatePortfolioItemRequest: {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 200 },
            description: { type: 'string', maxLength: 5000 },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 30 },
            published: { type: 'boolean' },
          },
        },
        CategoryNode: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Illustration' },
            slug: { type: 'string', example: 'illustration' },
            parentId: { type: 'string', format: 'uuid', nullable: true },
            children: {
              type: 'array',
              items: { $ref: '#/components/schemas/CategoryNode' },
            },
          },
        },
        CategoryListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { type: 'array', items: { $ref: '#/components/schemas/CategoryNode' } },
          },
        },
        Tag: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'watercolor' },
            slug: { type: 'string', example: 'watercolor' },
          },
        },
        TagListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
          },
        },
        TagResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/Tag' },
          },
        },
        CreateTagRequest: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', maxLength: 40, example: 'watercolor' } },
        },
        SyncArtworkTagsRequest: {
          type: 'object',
          required: ['tags'],
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string', maxLength: 40 },
              maxItems: 30,
              example: ['watercolor', 'portrait'],
            },
          },
        },
        ArtworkTagsResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                tags: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        ReorderPortfolioItemsRequest: {
          type: 'object',
          required: ['orderedIds'],
          properties: {
            orderedIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              minItems: 1,
              description: "Must contain exactly the caller's portfolio item ids.",
            },
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
        ToggleSaveResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                saved: { type: 'boolean' },
              },
            },
          },
        },
        SavedArtworkSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            category: { type: 'string' },
            coverMediaId: { type: 'string', format: 'uuid', nullable: true },
            savedAt: { type: 'string', format: 'date-time' },
          },
        },
        SavedArtworksResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/SavedArtworkSummary' },
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
        CreateThreadRequest: {
          type: 'object',
          properties: {
            participantId: {
              type: 'string',
              format: 'uuid',
              description: 'The other participant; the caller is always included.',
            },
            participantIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              minItems: 2,
              maxItems: 2,
              description:
                'Alias for `participantId`: exactly two ids, one of which must be the caller.',
            },
          },
        },
        ThreadParticipant: {
          type: 'object',
          required: ['userId', 'name', 'username'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Ada Lovelace' },
            username: { type: 'string', example: 'ada' },
          },
        },
        Thread: {
          type: 'object',
          required: ['id', 'createdAt', 'updatedAt', 'participants'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            participants: {
              type: 'array',
              items: { $ref: '#/components/schemas/ThreadParticipant' },
            },
          },
        },
        ThreadResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/Thread' },
          },
        },
        ThreadReadResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              required: ['threadId', 'markedRead', 'unreadCount', 'readAt'],
              properties: {
                threadId: { type: 'string', format: 'uuid' },
                markedRead: {
                  type: 'integer',
                  description: 'Messages this call flipped from unread to read.',
                  example: 3,
                },
                unreadCount: {
                  type: 'integer',
                  description: 'Unread messages left in the thread after marking.',
                  example: 0,
                },
                readAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Timestamp stamped on every message this call marked.',
                },
              },
            },
          },
        },
        CommissionStatus: {
          type: 'string',
          description: 'Current position of a commission in its lifecycle.',
          enum: [
            'PENDING',
            'ACCEPTED',
            'IN_PROGRESS',
            'DELIVERED',
            'COMPLETED',
            'CANCELLED',
            'DISPUTED',
          ],
        },
        CommissionReview: {
          type: 'object',
          description: 'Rating the client leaves when completing a commission.',
          required: ['rating', 'body'],
          properties: {
            rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
            title: { type: 'string', maxLength: 120, example: 'Excellent work' },
            body: { type: 'string', maxLength: 2000, example: 'Delivered ahead of the deadline.' },
          },
        },
        Commission: {
          type: 'object',
          required: [
            'id',
            'clientId',
            'artistId',
            'title',
            'budget',
            'asset',
            'deadline',
            'status',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            clientId: {
              type: 'string',
              format: 'uuid',
              description: 'User who requested the work.',
            },
            artistId: {
              type: 'string',
              format: 'uuid',
              description: 'Artist who performs the work.',
            },
            title: { type: 'string', example: 'Album cover illustration' },
            description: { type: 'string', nullable: true },
            budget: {
              type: 'string',
              example: '250.00',
              description: 'Decimal serialized as a string.',
            },
            asset: { type: 'string', enum: ['USDC', 'XLM'] },
            deadline: { type: 'string', format: 'date-time' },
            status: { $ref: '#/components/schemas/CommissionStatus' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CommissionResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/Commission' },
          },
        },
        CommissionStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              allOf: [{ $ref: '#/components/schemas/CommissionStatus' }],
              description:
                'Target status. Allowed per actor: artist PENDING→ACCEPTED, ACCEPTED→IN_PROGRESS, ' +
                'IN_PROGRESS→DELIVERED; client DELIVERED→COMPLETED (review required), ' +
                'DELIVERED→DISPUTED or DELIVERED→IN_PROGRESS (request a revision). ' +
                'PENDING/ACCEPTED/IN_PROGRESS→CANCELLED by either party.',
            },
            review: {
              allOf: [{ $ref: '#/components/schemas/CommissionReview' }],
              description: 'Required when `status` is COMPLETED; rejected otherwise.',
            },
          },
        },
        Review: {
          type: 'object',
          required: ['id', 'authorId', 'targetId', 'rating', 'body', 'createdAt'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            orderId: { type: 'string', format: 'uuid', nullable: true },
            commissionId: { type: 'string', format: 'uuid', nullable: true },
            authorId: { type: 'string', format: 'uuid', description: 'Reviewer.' },
            targetId: { type: 'string', format: 'uuid', description: 'Reviewed artist.' },
            rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
            title: { type: 'string', nullable: true, example: 'Excellent work' },
            body: { type: 'string', example: 'Matched the description and shipped quickly.' },
            edited: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateReviewRequest: {
          type: 'object',
          required: ['rating', 'body'],
          properties: {
            orderId: {
              type: 'string',
              format: 'uuid',
              description:
                'Completed order being reviewed. Provide exactly one of orderId/commissionId.',
            },
            commissionId: {
              type: 'string',
              format: 'uuid',
              description: 'Completed commission being reviewed. Provide exactly one of them.',
            },
            targetId: {
              type: 'string',
              format: 'uuid',
              description:
                'Ignored: the reviewed artist (order seller / commission artist) is derived server-side.',
            },
            rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
            title: { type: 'string', maxLength: 200, example: 'Excellent work' },
            body: { type: 'string', minLength: 1, maxLength: 5000, example: 'Delivered on time.' },
          },
        },
        ReviewResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/Review' },
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
