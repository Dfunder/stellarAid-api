/**
 * Message threads (v1) — create, list, send, fetch messages and mark read
 * (#837–#840).
 *
 * @openapi
 * /api/v1/threads:
 *   post:
 *     summary: Create or retrieve a message thread
 *     tags: [Threads]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               participantId: { type: string, format: uuid }
 *               participantIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Thread created
 *       200:
 *         description: Existing thread returned
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 *   get:
 *     summary: List the current user's threads
 *     tags: [Threads]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User threads
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 * /api/v1/threads/{id}/messages:
 *   post:
 *     summary: Send a message in a thread
 *     tags: [Threads]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string, minLength: 1 }
 *     responses:
 *       201:
 *         description: Message sent
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 *   get:
 *     summary: List messages in a thread
 *     tags: [Threads]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Messages page
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/threads/{id}/read:
 *   patch:
 *     summary: Mark a thread as read
 *     tags: [Threads]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Thread read receipt updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
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
