import type { Commission } from '@prisma/client';
import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  createCommission,
  getCommissionDetail,
  updateCommissionStatus,
  type CommissionDetail,
} from '@/services';
import type { ApiResponse } from '@/types';
import type {
  CommissionBodySchema,
  CommissionStatusBodySchema,
  CommissionStatusParamsSchema,
} from '@/validators';

/** POST /api/v1/commissions — a client requests work from an artist. */
export const postCommission = catchAsync(async (req, res: Response<ApiResponse<Commission>>) => {
  const { sub } = getAuthUser(req);
  const { body } = getValidated<CommissionBodySchema, unknown, unknown>(req);
  const commission = await createCommission(sub, body);
  res.status(201).json({ success: true, data: commission });
});

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

/** GET /api/v1/commissions/:id — client, artist or admin only. */
export const getCommissionById = catchAsync(
  async (req, res: Response<ApiResponse<CommissionDetail>>) => {
    const { sub, role } = getAuthUser(req);
    const { params } = getValidated<unknown, CommissionStatusParamsSchema, unknown>(req);
    const detail = await getCommissionDetail(params.id, sub, role);
    res.status(200).json({ success: true, data: detail });
  },
);
