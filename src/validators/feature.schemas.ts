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

export const artworkIdParamsSchema = z.object({ id: uuidSchema });

export const setArtworkPublishedSchema = z.object({ published: z.boolean() });

export const categorySchema = z.object({ slug: slugSchema });

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

export const searchQuerySchema = cursorPaginationSchema.extend({
  q: z.string().trim().max(200).default(''),
  category: artworkCategorySchema.optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  asset: assetSchema.optional(),
export const artworkParamsSchema = z.object({ id: uuidSchema });

export const categorySchema = z.object({ slug: slugSchema });

const tagName = z.string().trim().min(1).max(40);

export const createTagSchema = z.object({ name: tagName });

export const syncArtworkTagsSchema = z.object({
  tags: z.array(tagName).max(30),
});

export const tagListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const marketplaceListSchema = z.object({
  query: paginationSchema.extend({ category: z.string().optional() }),
});

export const orderParamsSchema = z.object({ orderId: uuidSchema });
export const orderBodySchema = z.object({
  artworkId: uuidSchema,
  message: z.string().max(1000).optional(),
});

export const paymentParamsSchema = z.object({ orderId: uuidSchema });

export const commissionBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  budget: z.coerce.number().min(0),
  deadline: z.coerce.date(),
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

export type ArtworkSchema = z.infer<typeof artworkSchema>;
export type UpdateArtworkSchema = z.infer<typeof updateArtworkSchema>;
export type ArtworkIdParamsSchema = z.infer<typeof artworkIdParamsSchema>;
export type SetArtworkPublishedSchema = z.infer<typeof setArtworkPublishedSchema>;
export type MarketplaceListSchema = z.infer<typeof marketplaceListSchema>;
export type PortfolioItemIdParamsSchema = z.infer<typeof portfolioItemIdParamsSchema>;
export type CreatePortfolioItemSchema = z.infer<typeof createPortfolioItemSchema>;
export type UpdatePortfolioItemSchema = z.infer<typeof updatePortfolioItemSchema>;
export type ReorderPortfolioItemsSchema = z.infer<typeof reorderPortfolioItemsSchema>;
export type SearchQuerySchema = z.infer<typeof searchQuerySchema>;
export type ArtworkParamsSchema = z.infer<typeof artworkParamsSchema>;
export type CreateTagSchema = z.infer<typeof createTagSchema>;
export type SyncArtworkTagsSchema = z.infer<typeof syncArtworkTagsSchema>;
export type TagListQuerySchema = z.infer<typeof tagListQuerySchema>;
