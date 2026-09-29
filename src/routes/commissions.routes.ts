/**
 * Commissions routes (v1).
 */

import { createFeatureRouter } from './router-factory';
import { patchCommissionStatus, postCommission } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import {
  commissionBodySchema,
  commissionStatusBodySchema,
  commissionStatusParamsSchema,
} from '@/validators';

export const commissionsRouter = createFeatureRouter('commissions');

commissionsRouter.post('/', authenticate, validate({ body: commissionBodySchema }), postCommission);

commissionsRouter.patch(
  '/:id/status',
  authenticate,
  validate({ params: commissionStatusParamsSchema, body: commissionStatusBodySchema }),
  patchCommissionStatus,
);
