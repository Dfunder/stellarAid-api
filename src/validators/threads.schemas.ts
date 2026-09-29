import { z } from 'zod';
import { uuidSchema } from './common.schemas';

export const createThreadBodySchema = z.object({
  participantId: uuidSchema,
  /** Optional alias for clients sending a pair — second id must match the caller. */
  participantIds: z.array(uuidSchema).length(2).optional(),
});

export const threadIdParamsSchema = z.object({
  id: uuidSchema,
});

export type CreateThreadBodySchema = z.infer<typeof createThreadBodySchema>;
export type ThreadIdParamsSchema = z.infer<typeof threadIdParamsSchema>;
