/**
 * Order creation and payment-intent controller.
 */

import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  createOrder,
  createOrderPaymentIntent,
  type OrderSummary,
  type PaymentIntent,
} from '@/services';
import type { ApiResponse } from '@/types';
import type { OrderBodySchema, OrderPaymentIntentParamsSchema } from '@/validators';

/** POST /api/v1/orders */
export const postOrder = catchAsync(async (req, res: Response<ApiResponse<OrderSummary>>) => {
  const { sub } = getAuthUser(req);
  const { body } = getValidated<OrderBodySchema, unknown, unknown>(req);
  const summary = await createOrder(sub, body);
  res.status(201).json({ success: true, data: summary });
});

/** POST /api/v1/orders/:id/payment-intent */
export const postOrderPaymentIntent = catchAsync(
  async (req, res: Response<ApiResponse<PaymentIntent>>) => {
    const { sub } = getAuthUser(req);
    const { params } = getValidated<unknown, OrderPaymentIntentParamsSchema, unknown>(req);
    const intent = await createOrderPaymentIntent(params.id, sub);
    res.status(200).json({ success: true, data: intent });
  },
);
