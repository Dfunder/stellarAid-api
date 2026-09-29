import type { Response } from 'express';

import { AppError, catchAsync, getAuthUser, getValidated } from '@/middlewares';
import { createOrGetThread, markThreadRead, type ReadReceipts } from '@/services/threads.service';
import type { ApiResponse } from '@/types';
import type { CreateThreadBodySchema, ThreadIdParamsSchema } from '@/validators/threads.schemas';

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

/** PATCH /api/v1/threads/:id/read (#840) */
export const patchThreadRead = catchAsync(async (req, res: Response<ApiResponse<ReadReceipts>>) => {
  const { sub } = getAuthUser(req);
  const { params } = getValidated<unknown, ThreadIdParamsSchema, unknown>(req);
  const receipts = await markThreadRead(params.id, sub);
  res.status(200).json({ success: true, data: receipts });
});
