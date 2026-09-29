/**
 * Order controllers.
 */

import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  createOrder,
  createOrderPaymentIntent,
  type OrderPaymentIntent,
  type OrderSummary,
} from '@/services';
import type { ApiResponse } from '@/types';
import type { OrderBodySchema, PaymentParamsSchema } from '@/validators';

/** POST /api/v1/orders */
export const postOrder = catchAsync(async (req, res: Response<ApiResponse<OrderSummary>>) => {
  const { sub } = getAuthUser(req);
  const { body } = getValidated<OrderBodySchema, unknown, unknown>(req);
  const summary = await createOrder(sub, body);
  res.status(201).json({ success: true, data: summary });
});

/** POST /api/v1/orders/:id/payment-intent — unsigned Stellar payment for the buyer (#764). */
export const postOrderPaymentIntent = catchAsync(
  async (req, res: Response<ApiResponse<OrderPaymentIntent>>) => {
    const { sub } = getAuthUser(req);
    const { params } = getValidated<unknown, PaymentParamsSchema, unknown>(req);
    const intent = await createOrderPaymentIntent(params.id, sub);
    res.status(200).json({ success: true, data: intent });
  },
);
