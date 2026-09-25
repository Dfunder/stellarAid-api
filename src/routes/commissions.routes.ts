/**
 * Commissions routes (v1).
 */

import { createFeatureRouter } from './router-factory';
import { postCommission } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import { commissionBodySchema } from '@/validators';

export const commissionsRouter = createFeatureRouter('commissions');

commissionsRouter.post('/', authenticate, validate({ body: commissionBodySchema }), postCommission);
