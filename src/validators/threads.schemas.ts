import { z } from 'zod';
import { uuidSchema } from './common.schemas';

export const createThreadBodySchema = z.object({
  participantId: uuidSchema,
  /** Optional alias for clients sending a pair — second id must match the caller. */
  participantIds: z.array(uuidSchema).length(2).optional(),
});

export type CreateThreadBodySchema = z.infer<typeof createThreadBodySchema>;

export const threadIdParamsSchema = z.object({
  id: uuidSchema,
});

export const sendMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().datetime().optional(),
});

export type SendMessageBodySchema = z.infer<typeof sendMessageBodySchema>;
export type ListMessagesQuerySchema = z.infer<typeof listMessagesQuerySchema>;
