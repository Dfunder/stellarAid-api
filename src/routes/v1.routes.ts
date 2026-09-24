/**
 * Versioned API router (v1).
 *
 * Every feature router mounts under `/api/v1/<feature>`. Feature routers are
 * created by the router factory so protection (e.g. auth rate limiting) and
 * construction stay consistent.
 */

import { Router } from 'express';
import { adminRouter } from './admin.routes';
import { artworksRouter } from './artworks.routes';
import { authRouter } from './auth.routes';
import { categoriesRouter } from './categories.routes';
import { commissionsRouter } from './commissions.routes';
import { v1HealthRouter } from './health-v1.routes';
import { marketplaceRouter } from './marketplace.routes';
import { messagesRouter } from './messages.routes';
import { notificationsRouter } from './notifications.routes';
import { ordersRouter } from './orders.routes';
import { paymentsRouter } from './payments.routes';
import { portfoliosRouter } from './portfolios.routes';
import { profilesRouter } from './profiles.routes';
import { reviewsRouter } from './reviews.routes';
import { searchRouter } from './search.routes';
import { usersRouter } from './users.routes';

export const v1Router: Router = Router();

v1Router.use('/health', v1HealthRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/profiles', profilesRouter);
v1Router.use('/portfolios', portfoliosRouter);
v1Router.use('/artworks', artworksRouter);
v1Router.use('/marketplace', marketplaceRouter);
v1Router.use('/search', searchRouter);
v1Router.use('/categories', categoriesRouter);
v1Router.use('/orders', ordersRouter);
v1Router.use('/payments', paymentsRouter);
v1Router.use('/commissions', commissionsRouter);
v1Router.use('/reviews', reviewsRouter);
v1Router.use('/messages', messagesRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/admin', adminRouter);
