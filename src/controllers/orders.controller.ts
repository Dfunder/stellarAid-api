/**
 * Order creation controller.
 */

import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import { createOrder, type OrderSummary } from '@/services';
import type { ApiResponse } from '@/types';
import type { OrderBodySchema } from '@/validators';

/** POST /api/v1/orders */
export const postOrder = catchAsync(async (req, res: Response<ApiResponse<OrderSummary>>) => {
  const { sub } = getAuthUser(req);
  const { body } = getValidated<OrderBodySchema, unknown, unknown>(req);
  const summary = await createOrder(sub, body);
  res.status(201).json({ success: true, data: summary });
});
