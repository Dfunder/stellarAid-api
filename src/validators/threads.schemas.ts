import { z } from 'zod';
import { MESSAGE_MAX_LENGTH } from '@/services/threads.service';

export const threadIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const sendMessageBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message body cannot be empty')
    .max(MESSAGE_MAX_LENGTH),
});

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  /** ISO timestamp cursor — messages strictly after this createdAt (oldest-first pages). */
  cursor: z.string().datetime().optional(),
});

export type ThreadIdParams = z.infer<typeof threadIdParamsSchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
