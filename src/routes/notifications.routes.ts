/**
 * Notifications routes (v1) — list, mark read, mark all read, unread count
 * (#842).
 *
 * @openapi
 * /api/v1/notifications:
 *   get:
 *     summary: List notifications
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Notifications page
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 * /api/v1/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications marked as read
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { createFeatureRouter } from './router-factory';
import {
  getNotifications,
  getUnreadNotificationsCount,
  patchAllNotificationsRead,
  patchNotificationRead,
} from '@/controllers/notifications.controller';
import { authenticate, validate } from '@/middlewares';
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
} from '@/validators/notifications.schemas';

export const notificationsRouter = createFeatureRouter('notifications');

notificationsRouter.get(
  '/',
  authenticate,
  validate({ query: listNotificationsQuerySchema }),
  getNotifications,
);

// Static paths are registered before `/:id/...` so they can never be
// shadowed by a parameterised match.
notificationsRouter.get('/unread-count', authenticate, getUnreadNotificationsCount);
notificationsRouter.patch('/read-all', authenticate, patchAllNotificationsRead);
notificationsRouter.patch(
  '/:id/read',
  authenticate,
  validate({ params: notificationIdParamsSchema }),
  patchNotificationRead,
);
