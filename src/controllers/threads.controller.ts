import type { Response } from 'express';

import { AppError, catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  createOrGetThread,
  listThreadMessages,
  listUserThreads,
  sendMessage,
} from '@/services/threads.service';
import type { ApiResponse } from '@/types';
import type {
  CreateThreadBodySchema,
  ListMessagesQuerySchema,
  SendMessageBodySchema,
} from '@/validators/threads.schemas';

export const postThread = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const { body: input } = getValidated<CreateThreadBodySchema, unknown, unknown>(req);

  let participantId = input.participantId;
  if (input.participantIds?.length === 2) {
    const other = input.participantIds.find((id) => id !== sub);
    if (!other) {
      throw new AppError('BAD_REQUEST', 'participantIds must include the other user');
    }
    participantId = other;
  }

  const { thread, created } = await createOrGetThread(sub, { participantId });
  res
    .status(created ? 201 : 200)
    .json({ success: true, data: thread } satisfies ApiResponse<typeof thread>);
});

/** GET /api/v1/threads (#839) */
export const getThreads = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const threads = await listUserThreads(sub);
  res.status(200).json({ success: true, data: threads } satisfies ApiResponse<typeof threads>);
});

/** POST /api/v1/threads/:id/messages (#838) */
export const postThreadMessage = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const { params, body } = getValidated<
    SendMessageBodySchema,
    { id: string },
    unknown
  >(req);
  const message = await sendMessage(params.id, sub, body.body);
  res.status(201).json({ success: true, data: message } satisfies ApiResponse<typeof message>);
});

/** GET /api/v1/threads/:id/messages (#839) */
export const getThreadMessages = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const { params, query } = getValidated<
    unknown,
    { id: string },
    ListMessagesQuerySchema
  >(req);
  const page = await listThreadMessages(params.id, sub, {
    limit: query.limit,
    cursor: query.cursor,
  });
  res.status(200).json({ success: true, data: page } satisfies ApiResponse<typeof page>);
});
