import { z } from 'zod';

export const reviewIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const updateReviewBodySchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    title: z.string().max(200).nullable().optional(),
    body: z.string().min(1).max(5000).optional(),
  })
  .refine((v) => v.rating !== undefined || v.title !== undefined || v.body !== undefined, {
    message: 'At least one of rating, title, or body is required',
  });

export const moderateReviewBodySchema = z.object({
  action: z.enum(['approve', 'remove']),
  note: z.string().max(1000).optional(),
});

export const reportedReviewsQuerySchema = z.object({
  status: z.enum(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ReviewIdParams = z.infer<typeof reviewIdParamsSchema>;
export type UpdateReviewBody = z.infer<typeof updateReviewBodySchema>;
export type ModerateReviewBody = z.infer<typeof moderateReviewBodySchema>;
export type ReportedReviewsQuery = z.infer<typeof reportedReviewsQuerySchema>;
