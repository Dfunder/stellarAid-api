/**
 * Notification writes.
 *
 * Notifications are polymorphic (`type` + a free-form `data` payload) so a
 * new notification kind never needs a schema change. Callers pass either the
 * Prisma client or a transaction client so a notification can be written in
 * the same transaction as the change it describes.
 */

import type { Prisma } from '@prisma/client';

export interface NotifyInput {
  readonly userId: string;
  readonly type: string;
  readonly data?: Prisma.InputJsonValue;
}

export function createNotification(
  tx: Prisma.TransactionClient,
  input: NotifyInput,
): Promise<{ id: string }> {
  return tx.notification.create({
    data: { userId: input.userId, type: input.type, data: input.data },
    select: { id: true },
  });
}
