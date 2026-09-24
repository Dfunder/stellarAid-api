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

export const artworkIdParamsSchema = z.object({ id: uuidSchema });

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

export const portfolioItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(30).optional(),
  published: z.boolean().default(false),
});

export const artworkSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(30).optional(),
  published: z.boolean().default(false),
});

export const categorySchema = z.object({ slug: slugSchema });

export const marketplaceListSchema = paginationSchema.extend({
  category: artworkCategorySchema.optional(),
});

export const searchQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(200).default(''),
  category: artworkCategorySchema.optional(),
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

export type ArtworkIdParamsSchema = z.infer<typeof artworkIdParamsSchema>;
export type MarketplaceListSchema = z.infer<typeof marketplaceListSchema>;
export type SearchQuerySchema = z.infer<typeof searchQuerySchema>;
