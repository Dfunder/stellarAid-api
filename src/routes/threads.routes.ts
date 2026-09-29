/**
 * Message threads (v1) — create, list, send, fetch messages and mark read
 * (#837–#840).
 */

import { createFeatureRouter } from './router-factory';
import {
  getThreadMessages,
  getThreads,
  patchThreadRead,
  postThread,
  postThreadMessage,
} from '@/controllers/threads.controller';
import { authenticate, validate } from '@/middlewares';
import {
  createThreadBodySchema,
  listMessagesQuerySchema,
  sendMessageBodySchema,
  threadIdParamsSchema,
} from '@/validators/threads.schemas';

export const threadsRouter = createFeatureRouter('threads');

threadsRouter.post('/', authenticate, validate({ body: createThreadBodySchema }), postThread);

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

// Read receipts (#840): stamps every unread message addressed to the caller.
threadsRouter.patch(
  '/:id/read',
  authenticate,
  validate({ params: threadIdParamsSchema }),
  patchThreadRead,
);
