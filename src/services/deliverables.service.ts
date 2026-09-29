/**
 * Commission deliverables — the artist's submissions (#784).
 *
 * A submission is a version of the work: the row records the note, the
 * WIP/FINAL type and the media attached to that version. Submitting `FINAL`
 * hands the work to the client (`DELIVERED`); a `WIP` draft only starts or
 * continues the work (`IN_PROGRESS`). The client's review of a submitted
 * version lives in #823.
 */

import type { CommissionStatus, DeliverableType, Prisma } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

/** A deliverable as it is returned to clients: the row plus its media. */
export type DeliverableWithMedia = Prisma.DeliverableGetPayload<{
  include: { media: true };
}>;

export const DELIVERABLE_MAX_MEDIA = 20;
export const DELIVERABLE_NOTE_MAX_LENGTH = 2000;

/**
 * Statuses an artist may submit from. `DELIVERED` is deliberately excluded:
 * that version is waiting on the client's review, and a revision request
 * puts the commission back to `IN_PROGRESS` before another submission is
 * allowed — so a version can never be replaced out from under a review.
 */
const SUBMITTABLE_STATUSES: readonly CommissionStatus[] = ['ACCEPTED', 'IN_PROGRESS'];

export interface SubmitDeliverableInput {
  readonly type: DeliverableType;
  readonly note?: string;
  readonly mediaIds?: readonly string[];
}

export interface SubmitDeliverableResult {
  readonly deliverable: DeliverableWithMedia;
  readonly commissionStatus: CommissionStatus;
}

/**
 * The artist on a commission submits a WIP draft or the final artefact.
 *
 * Only the assigned artist may submit (#784), only while the commission is
 * `ACCEPTED`/`IN_PROGRESS`, and every attached media row must belong to that
 * artist — otherwise an artist could reference (and effectively publish)
 * someone else's upload. The client is notified with the submission details,
 * and a `FINAL` submission moves the commission to `DELIVERED` and appends
 * the transition to the audit trail.
 */
export async function submitDeliverable(
  commissionId: string,
  artistId: string,
  input: SubmitDeliverableInput,
): Promise<SubmitDeliverableResult> {
  const note = input.note?.trim() ?? '';
  if (note.length > DELIVERABLE_NOTE_MAX_LENGTH) {
    throw new AppError(
      'BAD_REQUEST',
      `A submission note must be at most ${DELIVERABLE_NOTE_MAX_LENGTH} characters`,
    );
  }

  const mediaIds = [...new Set(input.mediaIds ?? [])];
  if (mediaIds.length > DELIVERABLE_MAX_MEDIA) {
    throw new AppError(
      'BAD_REQUEST',
      `At most ${DELIVERABLE_MAX_MEDIA} media files can be attached to a submission`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const commission = await tx.commission.findUnique({ where: { id: commissionId } });
    if (commission === null) {
      throw new AppError('NOT_FOUND', 'Commission not found');
    }
    if (commission.artistId !== artistId) {
      throw new AppError('FORBIDDEN', 'Only the artist on this commission can submit deliverables');
    }
    if (!SUBMITTABLE_STATUSES.includes(commission.status)) {
      throw new AppError(
        'CONFLICT',
        `Deliverables can only be submitted while a commission is ${SUBMITTABLE_STATUSES.join(' or ')} (this one is ${commission.status})`,
      );
    }

    if (mediaIds.length > 0) {
      const owned = await tx.media.findMany({
        where: { id: { in: mediaIds }, userId: artistId },
        select: { id: true },
      });
      if (owned.length !== mediaIds.length) {
        throw new AppError('BAD_REQUEST', 'Every attached media file must belong to you');
      }
    }

    const deliverable = await tx.deliverable.create({
      data: {
        commissionId,
        type: input.type,
        note: note === '' ? null : note,
        // The artist is submitting this version, not merely uploading it.
        status: 'SUBMITTED',
        ...(mediaIds.length > 0
          ? { media: { create: mediaIds.map((mediaId, sort) => ({ mediaId, sort })) } }
          : {}),
      },
      include: { media: true },
    });

    const toStatus: CommissionStatus = input.type === 'FINAL' ? 'DELIVERED' : 'IN_PROGRESS';
    let commissionStatus = commission.status;
    if (commission.status !== toStatus) {
      const updated = await tx.commission.update({
        where: { id: commissionId },
        data: { status: toStatus },
      });
      commissionStatus = updated.status;
      await tx.commissionEvent.create({
        data: {
          commissionId,
          fromStatus: commission.status,
          toStatus,
          actorId: artistId,
          note:
            input.type === 'FINAL' ? 'Final deliverable submitted' : 'Work in progress submitted',
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: commission.clientId,
        type: 'COMMISSION_DELIVERABLE_SUBMITTED',
        data: {
          commissionId,
          deliverableId: deliverable.id,
          type: input.type,
          note: note === '' ? null : note,
          mediaCount: mediaIds.length,
          commissionStatus,
        },
      },
    });

    return { deliverable, commissionStatus };
  });
}
