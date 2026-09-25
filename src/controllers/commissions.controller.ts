/** Commission request controllers. */

import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import { createCommission, type CreateCommissionInput } from '@/services';
import type { ApiResponse } from '@/types';
import type { CommissionBodySchema } from '@/validators';

export const postCommission = catchAsync(async (req, res: Response<ApiResponse>) => {
  const { sub } = getAuthUser(req);
  const { body } = getValidated<CommissionBodySchema, unknown, unknown>(req);
  const commission = await createCommission(sub, body as CreateCommissionInput);
  res.status(201).json({ success: true, data: commission });
});
