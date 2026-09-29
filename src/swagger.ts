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
      { name: 'Stats', description: 'Public, aggregate platform metrics.' },
      { name: 'Analytics', description: 'Product-analytics event ingestion.' },
      {
        name: 'Commissions',
        description:
          'Commission lifecycle, deliverables, disputes and the review written on completion.\n\n' +
          '### Flow\n' +
          '1. **Request** — the client calls `POST /api/v1/commissions`; the commission is created `PENDING` and the artist is notified.\n' +
          '2. **Accept** — the artist moves it to `ACCEPTED`, then to `IN_PROGRESS` while working.\n' +
          '3. **Deliver** — the artist marks the work `DELIVERED`.\n' +
          '4. **Accept or dispute** — the client either completes it (a review is **required**, and is stored as the commission review) or raises a dispute, which holds escrow.\n' +
          '5. **Resolve** — an admin releases the funds to the artist, refunds the client, or rejects the dispute.\n\n' +
          '### Status machine\n' +
          '```\n' +
          'PENDING ──▶ ACCEPTED ──▶ IN_PROGRESS ──▶ DELIVERED ──▶ COMPLETED\n' +
          '   │            │              │             │\n' +
          '   │            │              │             └──▶ DISPUTED ──▶ COMPLETED (RELEASE_TO_ARTIST)\n' +
          '   │            │              │                          ──▶ CANCELLED (REFUND_CLIENT)\n' +
          '   │            │              │                          ──▶ DELIVERED (REJECT)\n' +
          '   └────────────┴──────────────┴──▶ CANCELLED\n' +
          '```\n' +
          '\n' +
          '- `ACCEPTED` / `IN_PROGRESS` / `DELIVERED` — the artist moves the commission forward.\n' +
          '- `COMPLETED` — the client, and the request must carry a `review`.\n' +
          '- `CANCELLED` — either party, but only from `PENDING`, `ACCEPTED` or `IN_PROGRESS`.\n' +
          '- `DISPUTED` — the client, only from `DELIVERED`; escrow stays held while the dispute is `OPEN` or `REVIEWING`, so the commission cannot be completed or cancelled until an admin resolves it.\n' +
          '\n' +
          'Every transition is appended to an immutable `CommissionEvent` audit trail, which is what `GET /api/v1/commissions/{id}` returns as its `timeline`.',
      },
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
        CommissionConflict: {
          description: 'The requested transition is not allowed from the current status',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'CONFLICT',
                  message: 'Cannot change commission from PENDING to COMPLETED',
                },
              },
            },
          },
        },
        EscrowHeld: {
          description:
            'Escrow is held by an open dispute — the commission cannot be completed or cancelled until an admin resolves it',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'CONFLICT',
                  message: 'This commission has an open dispute; an admin must resolve it first',
                },
              },
            },
          },
        },
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
        Health: {
          type: 'object',
          required: ['status', 'uptime', 'timestamp'],
          properties: {
            status: { type: 'string', enum: ['ok'] },
            uptime: { type: 'number', description: 'Process uptime in seconds.' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        CommissionParty: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            username: { type: 'string' },
            role: { type: 'string', enum: ['USER', 'ARTIST', 'ADMIN'] },
          },
        },
        CommissionEvent: {
          type: 'object',
          description: 'Append-only status change recorded against a commission.',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fromStatus: { type: 'string', nullable: true, example: 'IN_PROGRESS' },
            toStatus: { type: 'string', example: 'DELIVERED' },
            actorId: { type: 'string', format: 'uuid' },
            note: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CommissionTimelineEntry: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['CREATED', 'STATUS_CHANGED'] },
            fromStatus: { type: 'string', nullable: true },
            toStatus: { type: 'string' },
            actorId: { type: 'string', format: 'uuid', nullable: true },
            note: { type: 'string', nullable: true },
            at: { type: 'string', format: 'date-time' },
          },
        },
        Commission: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            clientId: { type: 'string', format: 'uuid' },
            artistId: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            budget: { type: 'string', example: '450.00' },
            asset: { type: 'string', enum: ['USDC', 'XLM'] },
            deadline: { type: 'string', format: 'date-time' },
            status: {
              type: 'string',
              enum: [
                'PENDING',
                'ACCEPTED',
                'IN_PROGRESS',
                'DELIVERED',
                'COMPLETED',
                'DISPUTED',
                'CANCELLED',
              ],
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CommissionDetail: {
          type: 'object',
          properties: {
            commission: { $ref: '#/components/schemas/Commission' },
            parties: {
              type: 'object',
              properties: {
                client: {
                  allOf: [{ $ref: '#/components/schemas/CommissionParty' }],
                  nullable: true,
                },
                artist: {
                  allOf: [{ $ref: '#/components/schemas/CommissionParty' }],
                  nullable: true,
                },
              },
            },
            deliverables: {
              type: 'array',
              description: 'Oldest first.',
              items: { $ref: '#/components/schemas/Deliverable' },
            },
            reviews: {
              type: 'array',
              description: 'Reviews written against this commission (at most one).',
              items: { $ref: '#/components/schemas/CommissionReview' },
            },
            dispute: {
              allOf: [{ $ref: '#/components/schemas/CommissionDispute' }],
              nullable: true,
            },
            timeline: {
              type: 'array',
              description: 'Oldest first; always starts with the CREATED entry.',
              items: { $ref: '#/components/schemas/CommissionTimelineEntry' },
            },
          },
        },
        Deliverable: {
          type: 'object',
          description:
            'A version of the work — a `WIP` draft or the `FINAL` artefact. Moves UPLOADED -> SUBMITTED -> ACCEPTED | REJECTED.',
          properties: {
            id: { type: 'string', format: 'uuid' },
            commissionId: { type: 'string', format: 'uuid' },
            note: { type: 'string', nullable: true },
            type: { type: 'string', enum: ['WIP', 'FINAL'] },
            status: {
              type: 'string',
              enum: ['UPLOADED', 'SUBMITTED', 'ACCEPTED', 'REJECTED'],
            },
            media: {
              type: 'array',
              description: 'Media attached to this submission, in the artist order.',
              items: { $ref: '#/components/schemas/DeliverableMedia' },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        DeliverableMedia: {
          type: 'object',
          description: 'A media row attached to one submission.',
          properties: {
            deliverableId: { type: 'string', format: 'uuid' },
            mediaId: { type: 'string', format: 'uuid' },
            sort: {
              type: 'integer',
              description: 'Artist-defined ordering within the submission.',
            },
          },
        },
        CommissionReview: {
          type: 'object',
          description:
            'The review recorded when a commission is completed — one per commission, written by the client and targeting the artist.',
          properties: {
            id: { type: 'string', format: 'uuid' },
            commissionId: { type: 'string', format: 'uuid', nullable: true },
            authorId: { type: 'string', format: 'uuid', description: 'The client.' },
            targetId: { type: 'string', format: 'uuid', description: 'The artist.' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            title: { type: 'string', nullable: true },
            body: { type: 'string' },
            edited: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateCommissionRequest: {
          type: 'object',
          required: ['artistId', 'title', 'description', 'budget', 'asset', 'deadline'],
          properties: {
            artistId: {
              type: 'string',
              format: 'uuid',
              description: 'The artist to request work from. Must not be the caller.',
            },
            title: { type: 'string', minLength: 1, maxLength: 200, example: 'Album cover' },
            description: {
              type: 'string',
              minLength: 1,
              maxLength: 5000,
              example: 'A painted cover for an upcoming album.',
            },
            budget: {
              type: 'number',
              exclusiveMinimum: true,
              minimum: 0,
              description: 'Positive amount, in the units of `asset`.',
              example: 250,
            },
            asset: { type: 'string', enum: ['USDC', 'XLM'] },
            deadline: {
              type: 'string',
              format: 'date-time',
              description: 'Must be in the future.',
              example: '2027-01-01T00:00:00.000Z',
            },
          },
        },
        CommissionResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/Commission' },
          },
        },
        SubmitDeliverableRequest: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: ['WIP', 'FINAL'],
              description: '`FINAL` hands the work to the client; `WIP` is a draft for feedback.',
            },
            note: { type: 'string', maxLength: 2000, nullable: true },
            mediaIds: {
              type: 'array',
              maxItems: 20,
              description: 'Ids of media the artist has already uploaded. Order is preserved.',
              items: { type: 'string', format: 'uuid' },
            },
          },
        },
        SubmitDeliverableResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                deliverable: { $ref: '#/components/schemas/Deliverable' },
                commissionStatus: {
                  type: 'string',
                  enum: [
                    'PENDING',
                    'ACCEPTED',
                    'IN_PROGRESS',
                    'DELIVERED',
                    'COMPLETED',
                    'DISPUTED',
                    'CANCELLED',
                  ],
                },
              },
            },
          },
        },
        CommissionListItem: {
          allOf: [
            { $ref: '#/components/schemas/Commission' },
            {
              type: 'object',
              properties: {
                client: {
                  allOf: [{ $ref: '#/components/schemas/CommissionParty' }],
                  nullable: true,
                },
                artist: {
                  allOf: [{ $ref: '#/components/schemas/CommissionParty' }],
                  nullable: true,
                },
              },
            },
          ],
        },
        CommissionListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/CommissionListItem' },
                },
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                total: { type: 'integer', example: 3 },
                hasNext: { type: 'boolean' },
              },
            },
          },
        },
        CommissionDetailResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/CommissionDetail' },
          },
        },
        CommissionDispute: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            commissionId: { type: 'string', format: 'uuid' },
            raisedById: { type: 'string', format: 'uuid' },
            reason: { type: 'string' },
            evidence: { description: 'Free-form dispute evidence.', nullable: true },
            status: {
              type: 'string',
              enum: ['OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED'],
            },
            resolution: { type: 'string', nullable: true },
            resolvedById: { type: 'string', format: 'uuid', nullable: true },
            resolvedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateCommissionDisputeRequest: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', minLength: 1, maxLength: 2000 },
            evidence: { type: 'object', additionalProperties: true },
          },
        },
        CommissionDisputeResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { $ref: '#/components/schemas/CommissionDispute' },
          },
        },
        CommissionDisputeListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: {
              type: 'array',
              items: {
                allOf: [
                  { $ref: '#/components/schemas/CommissionDispute' },
                  {
                    type: 'object',
                    properties: {
                      commission: { $ref: '#/components/schemas/Commission' },
                    },
                  },
                ],
              },
            },
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
