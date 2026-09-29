import type { Commission, Deliverable } from '@prisma/client';
import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  cancelCommission,
  reviewDeliverable,
  submitDeliverable,
  updateCommissionStatus,
  type CommissionCancellationResult,
  type DeliverableReviewResult,
} from '@/services';
import type { ApiResponse } from '@/types';
import type {
  CancelCommissionBodySchema,
  CommissionStatusBodySchema,
  CommissionStatusParamsSchema,
  DeliverableReviewBodySchema,
  DeliverableReviewParamsSchema,
  DeliverableSubmissionBodySchema,
} from '@/validators';

/** PATCH /api/v1/commissions/:id/status */
export const patchCommissionStatus = catchAsync(
  async (req, res: Response<ApiResponse<Commission>>) => {
    const { sub, role } = getAuthUser(req);
    const { params, body } = getValidated<
      CommissionStatusBodySchema,
      CommissionStatusParamsSchema,
      unknown
    >(req);
    const commission = await updateCommissionStatus(params.id, sub, role, body);
    res.status(200).json({ success: true, data: commission });
  },
);

/** POST /api/v1/commissions/:id/deliverables */
export const postCommissionDeliverable = catchAsync(
  async (req, res: Response<ApiResponse<Deliverable>>) => {
    const { sub } = getAuthUser(req);
    const { params, body } = getValidated<
      DeliverableSubmissionBodySchema,
      CommissionStatusParamsSchema,
      unknown
    >(req);
    const deliverable = await submitDeliverable(params.id, sub, body);
    res.status(201).json({ success: true, data: deliverable });
  },
);

/** PATCH /api/v1/commissions/:id/deliverables/:deliverableId */
export const patchCommissionDeliverableReview = catchAsync(
  async (req, res: Response<ApiResponse<DeliverableReviewResult>>) => {
    const { sub } = getAuthUser(req);
    const { params, body } = getValidated<
      DeliverableReviewBodySchema,
      DeliverableReviewParamsSchema,
      unknown
    >(req);
    const result = await reviewDeliverable(params.id, params.deliverableId, sub, body);
    res.status(200).json({ success: true, data: result });
  },
);

/** POST /api/v1/commissions/:id/cancel */
export const postCommissionCancel = catchAsync(
  async (req, res: Response<ApiResponse<CommissionCancellationResult>>) => {
    const { sub } = getAuthUser(req);
    const { params, body } = getValidated<
      CancelCommissionBodySchema,
      CommissionStatusParamsSchema,
      unknown
    >(req);
    const result = await cancelCommission(params.id, sub, body);
    res.status(200).json({ success: true, data: result });
  },
);
