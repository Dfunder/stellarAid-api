/**
 * Feature-scoped request validation schemas.
 *
 * Each feature owns the schemas for its incoming requests. They are applied
 * with the `validate()` middleware so controllers only receive parsed data.
 */

import { z } from 'zod';
import { paginationSchema, slugSchema, uuidSchema } from './common.schemas';

const ARTWORK_CATEGORIES = [
  'ART',
  'ILLUSTRATION',
  'GRAPHIC_DESIGN',
  'PHOTOGRAPHY',
  'DIGITAL_PAINTING',
  'THREE_D_ART',
  'ANIMATION',
  'UX_UI',
  'MUSIC',
  'WRITING',
  'OTHER',
] as const;
const artworkCategorySchema = z.enum(ARTWORK_CATEGORIES);
const assetSchema = z.enum(['USDC', 'XLM']);

export const artworkIdParamsSchema = z.object({ id: uuidSchema });
export const artworkParamsSchema = z.object({ id: uuidSchema });

export const userParamsSchema = z.object({ userId: uuidSchema });
export const listUsersSchema = z.object({ query: paginationSchema });

export const profileParamsSchema = z.object({ userId: uuidSchema });
export const profileBodySchema = z.object({
  bio: z.string().max(2000).optional(),
  location: z.string().max(120).optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
  skills: z.array(z.string()).max(50).optional(),
  socialLinks: z.record(z.string(), z.string().url()).optional(),
});

export const portfolioItemIdParamsSchema = z.object({ id: uuidSchema });

export const createPortfolioItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(30).optional(),
});

export const updatePortfolioItemSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(30).optional(),
  published: z.boolean().optional(),
});

export const reorderPortfolioItemsSchema = z.object({
  orderedIds: z.array(uuidSchema).min(1).max(500),
});

export const artworkSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: artworkCategorySchema,
  tags: z.array(z.string()).max(30).optional(),
  price: z.coerce.number().min(0).optional(),
  asset: assetSchema.optional(),
});

export const updateArtworkSchema = artworkSchema.partial();

export const setArtworkPublishedSchema = z.object({ published: z.boolean() });

export const categorySchema = z.object({ slug: slugSchema });

/** Cursor pagination shared by marketplace browse results. */
const cursorPaginationSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const marketplaceListSchema = cursorPaginationSchema.extend({
  category: artworkCategorySchema.optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  asset: assetSchema.optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular', 'rating']).default('newest'),
});

export const searchQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(200).default(''),
  category: artworkCategorySchema.optional(),
});

const tagName = z.string().trim().min(1).max(40);

export const createTagSchema = z.object({ name: tagName });

export const syncArtworkTagsSchema = z.object({
  tags: z.array(tagName).max(30),
});

export const tagListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const orderParamsSchema = z.object({ orderId: uuidSchema });
export const orderBodySchema = z.object({
  artworkId: uuidSchema,
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

/** `POST /api/v1/orders/:id/payment-intent` (#764). */
export const paymentParamsSchema = z.object({ id: uuidSchema });

export const commissionBodySchema = z.object({
  artistId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  budget: z.coerce.number().finite().positive(),
  asset: assetSchema,
  deadline: z.coerce.date().refine((value) => value.getTime() > Date.now(), {
    message: 'Deadline must be in the future.',
  }),
});

export const commissionStatusParamsSchema = z.object({ id: uuidSchema });

const COMMISSION_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
] as const;

/** Filters for `GET /api/v1/users/me/commissions`. `view` defaults to the
 * caller's role, so artists see commissions they received and everyone else
 * sees the ones they requested. */
export const commissionListQuerySchema = paginationSchema
  .extend({
    view: z.enum(['client', 'artist']).optional(),
    status: z.enum(COMMISSION_STATUSES).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    sort: z.enum(['newest', 'oldest']).default('newest'),
  })
  .refine((value) => value.from === undefined || value.to === undefined || value.from <= value.to, {
    message: '`from` must not be after `to`.',
    path: ['from'],
  });

const commissionReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1).max(2000),
});

export const commissionStatusBodySchema = z
  .object({
    status: z.enum(['ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'CANCELLED']),
    review: commissionReviewSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.status === 'COMPLETED' && value.review === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['review'],
        message: 'A review is required when completing a commission.',
      });
    }
  });

const COMMISSION_DISPUTE_STATUSES = ['OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED'] as const;

/** Client-raised dispute on a delivered commission (#827). */
export const commissionDisputeBodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

/** Admin decision that ends a dispute. */
export const commissionDisputeResolveBodySchema = z.object({
  decision: z.enum(['RELEASE_TO_ARTIST', 'REFUND_CLIENT', 'REJECT']),
  resolution: z.string().trim().min(1).max(2000).optional(),
});

export const commissionDisputeListQuerySchema = z.object({
  status: z.enum(COMMISSION_DISPUTE_STATUSES).optional(),
});

export const reviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
});

export const messageBodySchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const notificationParamsSchema = z.object({ notificationId: uuidSchema });

export const adminParamsSchema = z.object({ userId: uuidSchema });
export const reportParamsSchema = z.object({ reportId: uuidSchema });

export type ArtworkIdParamsSchema = z.infer<typeof artworkIdParamsSchema>;
export type ArtworkParamsSchema = z.infer<typeof artworkParamsSchema>;
export type UserParamsSchema = z.infer<typeof userParamsSchema>;
export type ListUsersSchema = z.infer<typeof listUsersSchema>;
export type ProfileParamsSchema = z.infer<typeof profileParamsSchema>;
export type ProfileBodySchema = z.infer<typeof profileBodySchema>;
export type PortfolioItemIdParamsSchema = z.infer<typeof portfolioItemIdParamsSchema>;
export type CreatePortfolioItemSchema = z.infer<typeof createPortfolioItemSchema>;
export type UpdatePortfolioItemSchema = z.infer<typeof updatePortfolioItemSchema>;
export type ReorderPortfolioItemsSchema = z.infer<typeof reorderPortfolioItemsSchema>;
export type ArtworkSchema = z.infer<typeof artworkSchema>;
export type UpdateArtworkSchema = z.infer<typeof updateArtworkSchema>;
export type SetArtworkPublishedSchema = z.infer<typeof setArtworkPublishedSchema>;
export type CategorySchema = z.infer<typeof categorySchema>;
export type MarketplaceListSchema = z.infer<typeof marketplaceListSchema>;
export type SearchQuerySchema = z.infer<typeof searchQuerySchema>;
export type CreateTagSchema = z.infer<typeof createTagSchema>;
export type SyncArtworkTagsSchema = z.infer<typeof syncArtworkTagsSchema>;
export type TagListQuerySchema = z.infer<typeof tagListQuerySchema>;
export type OrderParamsSchema = z.infer<typeof orderParamsSchema>;
export type OrderBodySchema = z.infer<typeof orderBodySchema>;
export type PaymentParamsSchema = z.infer<typeof paymentParamsSchema>;
export type CommissionBodySchema = z.infer<typeof commissionBodySchema>;
export type CommissionStatusParamsSchema = z.infer<typeof commissionStatusParamsSchema>;
export type CommissionListQuerySchema = z.infer<typeof commissionListQuerySchema>;
export type CommissionDisputeBodySchema = z.infer<typeof commissionDisputeBodySchema>;
export type CommissionDisputeResolveBodySchema = z.infer<typeof commissionDisputeResolveBodySchema>;
export type CommissionDisputeListQuerySchema = z.infer<typeof commissionDisputeListQuerySchema>;
export type CommissionStatusBodySchema = z.infer<typeof commissionStatusBodySchema>;
export type ReviewBodySchema = z.infer<typeof reviewBodySchema>;
export type MessageBodySchema = z.infer<typeof messageBodySchema>;
export type NotificationParamsSchema = z.infer<typeof notificationParamsSchema>;
export type AdminParamsSchema = z.infer<typeof adminParamsSchema>;
export type ReportParamsSchema = z.infer<typeof reportParamsSchema>;
