import type { Commission } from '@prisma/client';
import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import { updateCommissionStatus } from '@/services';
import type { ApiResponse } from '@/types';
import type {
  CommissionStatusBodySchema,
  CommissionStatusParamsSchema,
} from '@/validators';

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
