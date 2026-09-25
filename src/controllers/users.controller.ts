/**
 * Users controller.
 *
 * Profile updates only ever touch the authenticated user's own record.
 */

import type { Response } from 'express';

import { AppError, catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  listRecentlyViewed,
  updateUserProfile,
  type PublicUser,
  type RecentlyViewedPage,
} from '@/services';
import type { ApiResponse } from '@/types';
import type { PaginationSchema, UpdateProfileSchema, UserIdParamsSchema } from '@/validators';

/** PATCH /api/v1/users/me */
export const updateMe = catchAsync(async (req, res: Response<ApiResponse<PublicUser>>) => {
  const { sub } = getAuthUser(req);
  const { body } = getValidated<UpdateProfileSchema, unknown, unknown>(req);
  const user = await updateUserProfile(sub, body);
  res.status(200).json({ success: true, data: user });
});

/** GET /api/v1/users/me/recently-viewed */
export const getMyRecentlyViewed = catchAsync(
  async (req, res: Response<ApiResponse<RecentlyViewedPage>>) => {
    const { sub } = getAuthUser(req);
    const { query } = getValidated<unknown, unknown, PaginationSchema>(req);
    const result = await listRecentlyViewed(sub, query.page, query.limit);
    res.status(200).json({ success: true, data: result });
  },
);

/** PATCH /api/v1/users/:id — allowed only when `:id` is the caller. */
export const updateUserById = catchAsync(async (req, res: Response<ApiResponse<PublicUser>>) => {
  const { sub } = getAuthUser(req);
  const { body, params } = getValidated<UpdateProfileSchema, UserIdParamsSchema, unknown>(req);
  if (params.id !== sub) {
    throw new AppError('FORBIDDEN', 'You can only update your own profile');
  }
  const user = await updateUserProfile(sub, body);
  res.status(200).json({ success: true, data: user });
});

/** GET /api/v1/users/me/recently-viewed */
export const getMyRecentlyViewed = catchAsync(
  async (req, res: Response<ApiResponse<RecentlyViewedPage>>) => {
    const { sub } = getAuthUser(req);
    const { query } = getValidated<unknown, unknown, PaginationSchema>(req);
    const result = await listRecentlyViewed(sub, query.page, query.limit);
    res.status(200).json({ success: true, data: result });
  },
);
