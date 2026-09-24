/**
 * Global error middleware.
 *
 * Express recognizes 4-argument middleware as the error handler. Anything
 * thrown or passed to `next(err)` from a route lands here.
 *
 * - `AppError`      → its status code with `{ error: { code, message, details? } }`
 * - `ZodError`      → 422 with `{ error: { code: "VALIDATION_ERROR", fields } }`
 * - anything else   → 500, stack trace logged (dev) or omitted (prod)
 */

import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '@/config';
import type { ApiErrorField, ApiResponse } from '@/types';
import { logger } from '@/utils';
import { AppError } from './app-error.middleware';

function zodFields(error: ZodError): ApiErrorField[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Request failed', {
        reqId: req.id,
        code: err.code,
        message: err.message,
        stack: env.isProduction ? undefined : err.stack,
      });
    } else {
      logger.warn('Request rejected', { reqId: req.id, code: err.code, message: err.message });
    }
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        fields: zodFields(err),
      },
    });
    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Unhandled request error', {
    reqId: req.id,
    name: error.name,
    message: error.message,
    stack: env.isProduction ? undefined : error.stack,
  });

  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}
