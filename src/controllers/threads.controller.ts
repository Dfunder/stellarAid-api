import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  listThreadMessages,
  listUserThreads,
  sendMessage,
} from '@/services/threads.service';
import type { ApiResponse } from '@/types';
import type {
  ListMessagesQuery,
  SendMessageBody,
  ThreadIdParams,
} from '@/validators/threads.schemas';

/** GET /api/v1/threads */
export const getThreads = catchAsync(async (req, res: Response<ApiResponse<unknown>>) => {
  const { sub } = getAuthUser(req);
  const threads = await listUserThreads(sub);
  res.status(200).json({ success: true, data: threads });
});

/** POST /api/v1/threads/:id/messages */
export const postThreadMessage = catchAsync(
  async (req, res: Response<ApiResponse<unknown>>) => {
    const { sub } = getAuthUser(req);
    const { params, body } = getValidated<SendMessageBody, ThreadIdParams, unknown>(
      req,
    );
    const message = await sendMessage(params.id, sub, body.body);
    res.status(201).json({ success: true, data: message });
  },
);

/** GET /api/v1/threads/:id/messages */
export const getThreadMessages = catchAsync(
  async (req, res: Response<ApiResponse<unknown>>) => {
    const { sub } = getAuthUser(req);
    const { params, query } = getValidated<
      unknown,
      ThreadIdParams,
      ListMessagesQuery
    >(req);
    const page = await listThreadMessages(params.id, sub, {
      limit: query.limit,
      cursor: query.cursor,
    });
    res.status(200).json({ success: true, data: page });
  },
);
