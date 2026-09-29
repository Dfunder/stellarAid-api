import type {
  Commission,
  CommissionStatus,
  Deliverable,
  DeliverableType,
  Prisma,
  Role,
} from '@prisma/client';

import { env } from '@/config';
import { AppError } from '@/middlewares';
import { prisma } from '@/services';

import { createNotification } from './notifications.service';

export interface CommissionReviewInput {
  readonly rating: number;
  readonly title?: string;
  readonly body: string;
}

export interface UpdateCommissionStatusInput {
  readonly status: CommissionStatus;
  readonly review?: CommissionReviewInput;
  /** Required for `CANCELLED`; ignored otherwise. */
  readonly reason?: string;
}

const ARTIST_TRANSITIONS: Partial<Record<CommissionStatus, CommissionStatus>> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'IN_PROGRESS',
  IN_PROGRESS: 'DELIVERED',
};

const CLIENT_TRANSITIONS: Partial<Record<CommissionStatus, readonly CommissionStatus[]>> = {
  DELIVERED: ['COMPLETED', 'DISPUTED'],
};

const CANCELLABLE_STATUSES: readonly CommissionStatus[] = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'];

/** Statuses in which the artist may hand in a WIP or FINAL deliverable. */
const SUBMITTABLE_STATUSES: readonly CommissionStatus[] = ['ACCEPTED', 'IN_PROGRESS'];

function assertTransition(
  commission: Commission,
  userId: string,
  role: Role,
  input: UpdateCommissionStatusInput,
): 'artist' | 'client' {
  const isArtist = commission.artistId === userId;
  const isClient = commission.clientId === userId;

  if (!isArtist && !isClient) {
    throw new AppError('FORBIDDEN', 'You do not participate in this commission');
  }

  if (isArtist && role === 'ARTIST' && ARTIST_TRANSITIONS[commission.status] === input.status) {
    return 'artist';
  }

  if (isClient && CLIENT_TRANSITIONS[commission.status]?.includes(input.status) === true) {
    return 'client';
  }

  throw new AppError(
    'CONFLICT',
    `Cannot change commission from ${commission.status} to ${input.status}`,
  );
}

export async function updateCommissionStatus(
  commissionId: string,
  userId: string,
  role: Role,
  input: UpdateCommissionStatusInput,
): Promise<Commission> {
  // Cancellation has its own flow (reason, escrow refund, notifications) —
  // delegate so the two entry points can't drift apart.
  if (input.status === 'CANCELLED') {
    const result = await cancelCommission(commissionId, userId, {
      reason: input.reason ?? 'Cancelled by participant',
    });
    return result.commission;
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const commission = await tx.commission.findUnique({ where: { id: commissionId } });
    if (commission === null) {
      throw new AppError('NOT_FOUND', 'Commission not found');
    }

    const actor = assertTransition(commission, userId, role, input);
    if (input.status === 'COMPLETED') {
      if (actor !== 'client' || input.review === undefined) {
        throw new AppError('BAD_REQUEST', 'A client review is required to complete a commission');
      }
      await tx.review.create({
        data: {
          commissionId,
          authorId: userId,
          targetId: commission.artistId,
          rating: input.review.rating,
          title: input.review.title,
          body: input.review.body,
        },
      });
    }

    return tx.commission.update({
      where: { id: commissionId },
      data: { status: input.status },
    });
  });
}

export interface SubmitDeliverableInput {
  readonly note?: string;
  /** `WIP` keeps the commission in progress; `FINAL` moves it to `DELIVERED`. */
  readonly type: DeliverableType;
  readonly mediaIds?: readonly string[];
}

/**
 * Artist hands in a deliverable. Only the assigned artist may submit, and
 * only while the commission is `ACCEPTED`/`IN_PROGRESS`. A FINAL submission
 * moves the commission to `DELIVERED` for client review; the client is
 * notified either way.
 */
export async function submitDeliverable(
  commissionId: string,
  userId: string,
  input: SubmitDeliverableInput,
): Promise<Deliverable> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const commission = await tx.commission.findUnique({ where: { id: commissionId } });
    if (commission === null) {
      throw new AppError('NOT_FOUND', 'Commission not found');
    }
    if (commission.artistId !== userId) {
      throw new AppError('FORBIDDEN', 'Only the assigned artist can submit deliverables');
    }
    if (!SUBMITTABLE_STATUSES.includes(commission.status)) {
      throw new AppError(
        'CONFLICT',
        `Cannot submit a deliverable while the commission is ${commission.status}`,
      );
    }

    const revision = commission.revisionCount + 1;
    const deliverable = await tx.deliverable.create({
      data: {
        commissionId,
        note: input.note,
        type: input.type,
        status: 'SUBMITTED',
        revision,
        mediaIds: input.mediaIds === undefined ? undefined : [...input.mediaIds],
      },
    });

    // A FINAL submission is what the client reviews; a WIP doesn't change
    // the client-facing state beyond confirming work is underway.
    await tx.commission.update({
      where: { id: commissionId },
      data: { status: input.type === 'FINAL' ? 'DELIVERED' : 'IN_PROGRESS' },
    });

    await tx.commissionEvent.create({
      data: {
        commissionId,
        type: 'DELIVERABLE_SUBMITTED',
        actorId: userId,
        message: input.note ?? null,
        data: {
          deliverableId: deliverable.id,
          deliverableType: input.type,
          revision,
        },
      },
    });

    await createNotification(tx, {
      userId: commission.clientId,
      type: 'commission.deliverable_submitted',
      data: {
        commissionId,
        deliverableId: deliverable.id,
        deliverableType: input.type,
        revision,
      },
    });

    return deliverable;
  });
}

export interface ReviewDeliverableInput {
  readonly decision: 'ACCEPT' | 'REQUEST_CHANGES';
  /** Required when `decision` is `REQUEST_CHANGES`. */
  readonly feedback?: string;
}

export interface DeliverableReviewResult {
  readonly deliverable: Deliverable;
  readonly commission: Commission;
}

/**
 * Client reviews a submitted deliverable.
 *
 * - `ACCEPT` marks the deliverable accepted, releases escrow (when funded)
 *   and completes the commission.
 * - `REQUEST_CHANGES` requires feedback, marks the deliverable rejected and
 *   sends the commission back to `IN_PROGRESS`, incrementing the revision
 *   counter up to `COMMISSION_MAX_REVISIONS`.
 *
 * The artist is notified of the decision in both cases.
 */
export async function reviewDeliverable(
  commissionId: string,
  deliverableId: string,
  userId: string,
  input: ReviewDeliverableInput,
): Promise<DeliverableReviewResult> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const commission = await tx.commission.findUnique({ where: { id: commissionId } });
    if (commission === null) {
      throw new AppError('NOT_FOUND', 'Commission not found');
    }
    if (commission.clientId !== userId) {
      throw new AppError('FORBIDDEN', 'Only the client can review deliverables');
    }

    const deliverable = await tx.deliverable.findUnique({ where: { id: deliverableId } });
    if (deliverable === null || deliverable.commissionId !== commissionId) {
      throw new AppError('NOT_FOUND', 'Deliverable not found');
    }
    if (deliverable.status !== 'SUBMITTED') {
      throw new AppError('CONFLICT', 'This deliverable is not awaiting review');
    }
    if (commission.status !== 'DELIVERED') {
      throw new AppError(
        'CONFLICT',
        `Cannot review a deliverable while the commission is ${commission.status}`,
      );
    }

    const now = new Date();

    if (input.decision === 'ACCEPT') {
      const updatedDeliverable = await tx.deliverable.update({
        where: { id: deliverableId },
        data: { status: 'ACCEPTED', reviewedAt: now, feedback: input.feedback ?? null },
      });
      const updatedCommission = await tx.commission.update({
        where: { id: commissionId },
        data: {
          status: 'COMPLETED',
          ...(commission.escrowFunded ? { escrowReleasedAt: now } : {}),
        },
      });

      await tx.commissionEvent.create({
        data: {
          commissionId,
          type: 'DELIVERABLE_ACCEPTED',
          actorId: userId,
          message: 'Deliverable accepted; commission completed',
          data: { deliverableId },
        },
      });
      if (commission.escrowFunded) {
        await tx.commissionEvent.create({
          data: {
            commissionId,
            type: 'ESCROW_RELEASED',
            actorId: userId,
            message: 'Escrow released to the artist',
            data: { amount: commission.budget.toString(), asset: commission.asset },
          },
        });
      }

      await createNotification(tx, {
        userId: commission.artistId,
        type: 'commission.deliverable_accepted',
        data: { commissionId, deliverableId, escrowReleased: commission.escrowFunded },
      });

      return { deliverable: updatedDeliverable, commission: updatedCommission };
    }

    const feedback = input.feedback?.trim();
    if (feedback === undefined || feedback.length === 0) {
      throw new AppError('BAD_REQUEST', 'Feedback is required when requesting changes');
    }
    const maxRevisions = env.commissionMaxRevisions;
    if (commission.revisionCount >= maxRevisions) {
      throw new AppError(
        'CONFLICT',
        `The maximum number of revisions (${maxRevisions}) has been reached`,
      );
    }

    const revisionCount = commission.revisionCount + 1;
    const updatedDeliverable = await tx.deliverable.update({
      where: { id: deliverableId },
      data: { status: 'REJECTED', reviewedAt: now, feedback },
    });
    const updatedCommission = await tx.commission.update({
      where: { id: commissionId },
      data: { status: 'IN_PROGRESS', revisionCount },
    });

    await tx.commissionEvent.create({
      data: {
        commissionId,
        type: 'CHANGES_REQUESTED',
        actorId: userId,
        message: feedback,
        data: { deliverableId, revisionCount },
      },
    });
    await createNotification(tx, {
      userId: commission.artistId,
      type: 'commission.changes_requested',
      data: { commissionId, deliverableId, revisionCount, feedback },
    });

    return { deliverable: updatedDeliverable, commission: updatedCommission };
  });
}

export interface CancelCommissionInput {
  readonly reason: string;
}

export interface CommissionCancellationResult {
  readonly commission: Commission;
  /** True when a funded escrow was refunded as part of the cancellation. */
  readonly refunded: boolean;
}

/**
 * Either party may cancel while the commission is still cancellable. The
 * reason is recorded on the commission and in its timeline, both parties are
 * notified, and a funded escrow is refunded to the client.
 */
export async function cancelCommission(
  commissionId: string,
  userId: string,
  input: CancelCommissionInput,
): Promise<CommissionCancellationResult> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const commission = await tx.commission.findUnique({ where: { id: commissionId } });
    if (commission === null) {
      throw new AppError('NOT_FOUND', 'Commission not found');
    }

    const isArtist = commission.artistId === userId;
    const isClient = commission.clientId === userId;
    if (!isArtist && !isClient) {
      throw new AppError('FORBIDDEN', 'You do not participate in this commission');
    }
    if (!CANCELLABLE_STATUSES.includes(commission.status)) {
      throw new AppError('CONFLICT', 'This commission can no longer be cancelled');
    }

    const reason = input.reason.trim();
    if (reason.length === 0) {
      throw new AppError('BAD_REQUEST', 'A cancellation reason is required');
    }

    const now = new Date();
    const refunded = commission.escrowFunded;
    const updated = await tx.commission.update({
      where: { id: commissionId },
      data: {
        status: 'CANCELLED',
        cancelReason: reason,
        cancelledAt: now,
        cancelledById: userId,
        ...(refunded ? { escrowRefundedAt: now } : {}),
      },
    });

    await tx.commissionEvent.create({
      data: {
        commissionId,
        type: 'CANCELLED',
        actorId: userId,
        message: reason,
        data: { refunded },
      },
    });
    if (refunded) {
      await tx.commissionEvent.create({
        data: {
          commissionId,
          type: 'ESCROW_REFUNDED',
          actorId: userId,
          message: 'Escrow refunded to the client',
          data: { amount: commission.budget.toString(), asset: commission.asset },
        },
      });
    }

    const payload = { commissionId, reason, cancelledById: userId, refunded };
    await createNotification(tx, {
      userId: commission.clientId,
      type: 'commission.cancelled',
      data: payload,
    });
    await createNotification(tx, {
      userId: commission.artistId,
      type: 'commission.cancelled',
      data: payload,
    });

    return { commission: updated, refunded };
  });
}
