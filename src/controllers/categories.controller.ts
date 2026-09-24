/**
 * Category taxonomy controller.
 */

import type { Response } from 'express';

import { catchAsync } from '@/middlewares';
import { listCategories, type CategoryNode } from '@/services';
import type { ApiResponse } from '@/types';

/** GET /api/v1/categories */
export const getCategories = catchAsync(
  async (_req, res: Response<ApiResponse<readonly CategoryNode[]>>) => {
    const categories = await listCategories();
    res.status(200).json({ success: true, data: categories });
  },
);
