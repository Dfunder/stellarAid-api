import { z } from 'zod';
import { paginationSchema, uuidSchema } from './common.schemas';

export const listReviewsParamsSchema = z.object({
  username: z.string().trim().min(1).max(64),
});

export const listReviewsQuerySchema = paginationSchema.extend({
  sort: z.enum(['recent', 'highest', 'lowest']).default('recent'),
});

export const reviewIdParamsSchema = z.object({
  id: uuidSchema,
});

export const reportReviewBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
  note: z.string().trim().max(2000).optional(),
});

export const createReviewBodySchema = z
  .object({
    orderId: uuidSchema.optional(),
    commissionId: uuidSchema.optional(),
    targetId: uuidSchema,
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1).max(5000),
  })
  .refine((v) => (v.orderId != null) !== (v.commissionId != null), {
    message: 'Provide exactly one of orderId or commissionId',
  });

export type ListReviewsQuerySchema = z.infer<typeof listReviewsQuerySchema>;
export type ReportReviewBodySchema = z.infer<typeof reportReviewBodySchema>;
export type CreateReviewBodySchema = z.infer<typeof createReviewBodySchema>;
