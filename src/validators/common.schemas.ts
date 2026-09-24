/**
 * Reusable request-validation schemas.
 *
 * Small, composable Zod schemas shared across feature validators.
 */

import { z } from 'zod';

/** Email address with basic normalization. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Must be a valid email address.')
  .max(255);

/** UUID v4 that appears in URLs and request bodies. */
export const uuidSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Must be a valid UUID.',
  );

/** Zero-based offset pagination (page/limit) with safe defaults. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationSchema = z.infer<typeof paginationSchema>;

/** Named identifier from a URL parameter. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a URL-safe slug.');
