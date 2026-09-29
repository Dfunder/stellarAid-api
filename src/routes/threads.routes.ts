/**
 * Message threads (v1) — POST /api/v1/threads (#837).
 */

import { createFeatureRouter } from './router-factory';
import { postThread } from '@/controllers/threads.controller';
import { authenticate, validate } from '@/middlewares';
import { createThreadBodySchema } from '@/validators/threads.schemas';

export const threadsRouter = createFeatureRouter('threads');

threadsRouter.post('/', authenticate, validate({ body: createThreadBodySchema }), postThread);
