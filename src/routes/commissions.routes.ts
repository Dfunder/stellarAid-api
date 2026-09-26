/**
 * Commissions routes (v1).
 */

import { createFeatureRouter } from './router-factory';
import { patchCommissionStatus } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import {
	commissionStatusBodySchema,
	commissionStatusParamsSchema,
} from '@/validators';

export const commissionsRouter = createFeatureRouter('commissions');

commissionsRouter.patch(
	'/:id/status',
	authenticate,
	validate({ params: commissionStatusParamsSchema, body: commissionStatusBodySchema }),
	patchCommissionStatus,
);
