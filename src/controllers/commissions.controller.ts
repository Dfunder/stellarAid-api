import type { Commission, CommissionDispute } from '@prisma/client';
import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  cancelCommission,
  createCommission,
  getCommissionDetail,
  listCommissionDisputes,
  listCommissionsForUser,
  raiseCommissionDispute,
  resolveCommissionDispute,
  updateCommissionStatus,
  type CommissionCancellation,
  type CommissionDetail,
  type PaginatedCommissions,
  type ResolvedDispute,
} from '@/services';
import type { ApiResponse } from '@/types';
import type {
  CommissionBodySchema,
  CommissionCancelBodySchema,
  CommissionDisputeBodySchema,
  CommissionDisputeListQuerySchema,
  CommissionDisputeResolveBodySchema,
  CommissionListQuerySchema,
  CommissionStatusBodySchema,
  CommissionStatusParamsSchema,
} from '@/validators';

type DisputeWithCommission = CommissionDispute & { readonly commission: Commission };

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

/** GET /api/v1/users/me/commissions — the caller's requested or received commissions. */
export const getMyCommissions = catchAsync(
  async (req, res: Response<ApiResponse<PaginatedCommissions>>) => {
    const { sub, role } = getAuthUser(req);
    const { query } = getValidated<unknown, unknown, CommissionListQuerySchema>(req);
    const result = await listCommissionsForUser(sub, role, query);
    res.status(200).json({ success: true, data: result });
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

/** POST /api/v1/commissions/:id/cancel — either party cancels with a reason (#826). */
export const postCommissionCancellation = catchAsync(
  async (req, res: Response<ApiResponse<CommissionCancellation>>) => {
    const { sub } = getAuthUser(req);
    const { params, body } = getValidated<
      CommissionCancelBodySchema,
      CommissionStatusParamsSchema,
      unknown
    >(req);
    const result = await cancelCommission(params.id, sub, body);
    res.status(200).json({ success: true, data: result });
  },
);

/** POST /api/v1/commissions/:id/disputes — the client disputes the final delivery. */
export const postCommissionDispute = catchAsync(
  async (req, res: Response<ApiResponse<CommissionDispute>>) => {
    const { sub } = getAuthUser(req);
    const { params, body } = getValidated<
      CommissionDisputeBodySchema,
      CommissionStatusParamsSchema,
      unknown
    >(req);
    const dispute = await raiseCommissionDispute(params.id, sub, body);
    res.status(201).json({ success: true, data: dispute });
  },
);

/** POST /api/v1/commissions/:id/disputes/resolve — admin only. */
export const postCommissionDisputeResolution = catchAsync(
  async (req, res: Response<ApiResponse<ResolvedDispute>>) => {
    const { sub, role } = getAuthUser(req);
    const { params, body } = getValidated<
      CommissionDisputeResolveBodySchema,
      CommissionStatusParamsSchema,
      unknown
    >(req);
    const result = await resolveCommissionDispute(params.id, sub, role, body);
    res.status(200).json({ success: true, data: result });
  },
);

/** GET /api/v1/admin/commissions/disputes — admin only. */
export const getCommissionDisputes = catchAsync(
  async (req, res: Response<ApiResponse<readonly DisputeWithCommission[]>>) => {
    const { role } = getAuthUser(req);
    const { query } = getValidated<unknown, unknown, CommissionDisputeListQuerySchema>(req);
    const disputes = await listCommissionDisputes(role, query.status);
    res.status(200).json({ success: true, data: disputes });
  },
);
