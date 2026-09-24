/**
 * Portfolio item controller — CRUD and ordering, scoped to the caller.
 */

import type { PortfolioItem } from '@prisma/client';
import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  createPortfolioItem,
  deletePortfolioItem,
  listPortfolioItems,
  reorderPortfolioItems,
  updatePortfolioItem,
} from '@/services';
import type { ApiResponse } from '@/types';
import type {
  CreatePortfolioItemSchema,
  PortfolioItemIdParamsSchema,
  ReorderPortfolioItemsSchema,
  UpdatePortfolioItemSchema,
} from '@/validators';

/** POST /api/v1/portfolios */
export const postPortfolioItem = catchAsync(
  async (req, res: Response<ApiResponse<PortfolioItem>>) => {
    const { sub } = getAuthUser(req);
    const { body } = getValidated<CreatePortfolioItemSchema, unknown, unknown>(req);
    const item = await createPortfolioItem(sub, body);
    res.status(201).json({ success: true, data: item });
  },
);

/** GET /api/v1/portfolios */
export const getPortfolioItems = catchAsync(
  async (req, res: Response<ApiResponse<readonly PortfolioItem[]>>) => {
    const { sub } = getAuthUser(req);
    const items = await listPortfolioItems(sub);
    res.status(200).json({ success: true, data: items });
  },
);

/** PATCH /api/v1/portfolios/:id */
export const patchPortfolioItem = catchAsync(
  async (req, res: Response<ApiResponse<PortfolioItem>>) => {
    const { sub } = getAuthUser(req);
    const { params, body } = getValidated<
      UpdatePortfolioItemSchema,
      PortfolioItemIdParamsSchema,
      unknown
    >(req);
    const item = await updatePortfolioItem(sub, params.id, body);
    res.status(200).json({ success: true, data: item });
  },
);

/** DELETE /api/v1/portfolios/:id */
export const removePortfolioItem = catchAsync(async (req, res: Response<ApiResponse<null>>) => {
  const { sub } = getAuthUser(req);
  const { params } = getValidated<unknown, PortfolioItemIdParamsSchema, unknown>(req);
  await deletePortfolioItem(sub, params.id);
  res.status(204).send();
});

/** PUT /api/v1/portfolios/reorder */
export const putPortfolioItemsOrder = catchAsync(
  async (req, res: Response<ApiResponse<readonly PortfolioItem[]>>) => {
    const { sub } = getAuthUser(req);
    const { body } = getValidated<ReorderPortfolioItemsSchema, unknown, unknown>(req);
    const items = await reorderPortfolioItems(sub, body.orderedIds);
    res.status(200).json({ success: true, data: items });
  },
);
