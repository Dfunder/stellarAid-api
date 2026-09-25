/**
 * Public platform stats controller.
 */

import type { Response } from 'express';

import { catchAsync } from '@/middlewares';
import { getPlatformStats, type PlatformStats } from '@/services';
import type { ApiResponse } from '@/types';

/** GET /api/v1/stats */
export const getStats = catchAsync(async (_req, res: Response<ApiResponse<PlatformStats>>) => {
  const stats = await getPlatformStats();
  res.status(200).json({ success: true, data: stats });
});
