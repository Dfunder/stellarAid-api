/**
 * Message threads (v1) — POST /api/v1/threads (#837),
 * PATCH /api/v1/threads/:id/read (#840).
 *
 * @openapi
 * /api/v1/threads:
 *   post:
 *     summary: Start (or reopen) a 1:1 thread
 *     description: >
 *       Returns the existing thread when the pair already has one, so the call
 *       is idempotent per participant pair. Either `participantId`, or the
 *       two-user `participantIds` alias (one of which must be the caller), may
 *       be sent. Responds 201 when a thread was created, 200 when one existed.
 *     tags: [Threads]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateThreadRequest'
 *     responses:
 *       200:
 *         description: Existing thread returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ThreadResponse'
 *       201:
 *         description: Thread created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ThreadResponse'
 *       400:
 *         description: Self-thread or missing participant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: BAD_REQUEST, message: Cannot create a thread with yourself }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Participant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: NOT_FOUND, message: Participant not found }
 * /api/v1/threads/{id}/read:
 *   patch:
 *     summary: Mark a thread's unread messages as read
 *     description: >
 *       Stamps `readAt` on every unread message in the thread and returns how
 *       many were marked plus the remaining unread count. Only a participant
 *       of the thread may call it; `Message.readAt` is a single column shared
 *       by the thread, so the caller's own messages are stamped as well.
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
 *         description: Read receipts for the thread
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ThreadReadResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not a participant of the thread
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: FORBIDDEN, message: You are not a participant in this thread }
 *       404:
 *         description: Thread not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: NOT_FOUND, message: Thread not found }
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { createFeatureRouter } from './router-factory';
import { patchThreadRead, postThread } from '@/controllers/threads.controller';
import { authenticate, validate } from '@/middlewares';
import { createThreadBodySchema, threadIdParamsSchema } from '@/validators/threads.schemas';

export const threadsRouter = createFeatureRouter('threads');

threadsRouter.post('/', authenticate, validate({ body: createThreadBodySchema }), postThread);

threadsRouter.patch(
  '/:id/read',
  authenticate,
  validate({ params: threadIdParamsSchema }),
  patchThreadRead,
);
