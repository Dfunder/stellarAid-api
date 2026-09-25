/**
 * Analytics event ingestion controller.
 */

import type { Response } from 'express';

import { catchAsync, getValidated } from '@/middlewares';
import { recordAnalyticsEvents, type RecordEventsResult } from '@/services';
import type { ApiResponse } from '@/types';
import type { AnalyticsEventBatchSchema } from '@/validators';

/** POST /api/v1/analytics/events */
export const postAnalyticsEvents = catchAsync(
  async (req, res: Response<ApiResponse<RecordEventsResult>>) => {
    const { body } = getValidated<AnalyticsEventBatchSchema, unknown, unknown>(req);
    const result = await recordAnalyticsEvents(body.events);
    res.status(202).json({ success: true, data: result });
  },
);
