/**
 * Threads & messages (#838, #839).
 */

import {
  getThreadMessages,
  getThreads,
  postThreadMessage,
} from '@/controllers/threads.controller';
import { authenticate, validate } from '@/middlewares';
import {
  listMessagesQuerySchema,
  sendMessageBodySchema,
  threadIdParamsSchema,
} from '@/validators/threads.schemas';

import { createFeatureRouter } from './router-factory';

export const threadsRouter = createFeatureRouter('threads');

threadsRouter.get('/', authenticate, getThreads);

threadsRouter.post(
  '/:id/messages',
  authenticate,
  validate({ params: threadIdParamsSchema, body: sendMessageBodySchema }),
  postThreadMessage,
);

threadsRouter.get(
  '/:id/messages',
  authenticate,
  validate({ params: threadIdParamsSchema, query: listMessagesQuerySchema }),
  getThreadMessages,
);
