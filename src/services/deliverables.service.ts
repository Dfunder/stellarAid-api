/**
 * Commission deliverables — the artist's submissions (#784) and the client's
 * review of them (#823).
 *
 * A submission is a version of the work: the row records the note, the
 * WIP/FINAL type and the media attached to that version. Submitting `FINAL`
 * hands the work to the client (`DELIVERED`); a `WIP` draft only starts or
 * continues the work (`IN_PROGRESS`). The client then accepts the final
 * version — which completes the commission and releases escrow — or sends it
 * back with a note, which is what a revision is.
 *
 * Escrow note: this service owns the *decision*, not the on-chain settlement.
 * The escrow contract (`contracts/escrow`) keys funds by commission id and
 * exposes `create_escrow` / `release_payment` / `refund_client`, all of which
 * require the caller (client or admin) to authorize the call itself. The API
 * holds no keys, so accepting a deliverable records the release as the
 * commission's `COMPLETED` transition and notifies the artist — the signed
 * contract invocation is the backend's to make, exactly as it already is for
 * an accepted dispute (#827).
 */

import type {
  CommissionDisputeStatus,
  CommissionStatus,
  Deliverable,
  DeliverableStatus,
  DeliverableType,
  Prisma,
} from '@prisma/client';

import { env } from '@/config';
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

export type DeliverableDecision = 'ACCEPT' | 'REQUEST_CHANGES';

export interface ReviewDeliverableInput {
  readonly decision: DeliverableDecision;
  readonly note?: string;
}

export interface ReviewDeliverableResult {
  readonly deliverable: Deliverable;
  readonly commissionStatus: CommissionStatus;
  /** Revisions recorded against the commission, including this one. */
  readonly revisionCount: number;
  readonly maxRevisions: number;
  /** True once the artist's payout has been released (commission COMPLETED). */
  readonly escrowReleased: boolean;
}

/**
 * Rejections *are* the revision history, so the revision count is derived
 * from them rather than stored on the commission — a counter column could
 * silently drift from the submissions it claims to describe.
 */
const REVISION_STATUS: DeliverableStatus = 'REJECTED';

/**
 * Dispute states that hold escrow. Mirrors `OPEN_DISPUTE_STATUSES` in
 * `commissions.service`, which owns the dispute rules; duplicated rather than
 * imported to keep the two services independent.
 */
const ESCROW_HOLDING_DISPUTE_STATUSES: readonly CommissionDisputeStatus[] = ['OPEN', 'REVIEWING'];

function assertNoteLength(note: string): void {
  if (note.length > DELIVERABLE_NOTE_MAX_LENGTH) {
    throw new AppError(
      'BAD_REQUEST',
      `A note must be at most ${DELIVERABLE_NOTE_MAX_LENGTH} characters`,
    );
  }
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
  assertNoteLength(note);

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

/**
 * The client reviews a submitted deliverable (#823).
 *
 * `ACCEPT` is the client's sign-off: only the `FINAL` version can be accepted,
 * and accepting it completes the commission, which is the state change that
 * releases the artist's escrow (see the module note on escrow).
 * `REQUEST_CHANGES` records the submission as `REJECTED` — that rejection is
 * the revision — requires the feedback note, returns the commission to
 * `IN_PROGRESS` for the artist, and is refused once the configured revision
 * limit is reached. The artist is notified of either decision.
 *
 * While a dispute is open, escrow is held and neither decision is allowed:
 * only an admin resolution can move the commission (the same rule the status
 * endpoint and dispute resolution already enforce).
 */
export async function reviewDeliverable(
  commissionId: string,
  deliverableId: string,
  clientId: string,
  input: ReviewDeliverableInput,
): Promise<ReviewDeliverableResult> {
  const note = input.note?.trim() ?? '';
  assertNoteLength(note);
  const maxRevisions = env.maxCommissionRevisions;

  if (input.decision === 'REQUEST_CHANGES' && note === '') {
    throw new AppError('BAD_REQUEST', 'A note is required when requesting changes');
  }

  return prisma.$transaction(async (tx) => {
    const commission = await tx.commission.findUnique({ where: { id: commissionId } });
    if (commission === null) {
      throw new AppError('NOT_FOUND', 'Commission not found');
    }
    if (commission.clientId !== clientId) {
      throw new AppError(
        'FORBIDDEN',
        'Only the client on this commission can review a deliverable',
      );
    }

    const deliverable = await tx.deliverable.findUnique({ where: { id: deliverableId } });
    if (deliverable === null || deliverable.commissionId !== commissionId) {
      throw new AppError('NOT_FOUND', 'Deliverable not found on this commission');
    }
    if (deliverable.status !== 'SUBMITTED') {
      throw new AppError(
        'CONFLICT',
        `This deliverable has already been ${deliverable.status.toLowerCase()}`,
      );
    }

    const openDispute = await tx.commissionDispute.findFirst({
      where: { commissionId, status: { in: [...ESCROW_HOLDING_DISPUTE_STATUSES] } },
    });
    if (openDispute !== null) {
      throw new AppError(
        'CONFLICT',
        'This commission has an open dispute; an admin must resolve it first',
      );
    }

    const revisionCount = await tx.deliverable.count({
      where: { commissionId, status: REVISION_STATUS },
    });

    if (input.decision === 'REQUEST_CHANGES') {
      if (revisionCount >= maxRevisions) {
        throw new AppError(
          'CONFLICT',
          `This commission has already used all ${maxRevisions} of its revisions`,
        );
      }

      const rejected = await tx.deliverable.update({
        where: { id: deliverableId },
        data: { status: 'REJECTED' },
      });

      // Back to the artist. The commission is already IN_PROGRESS whenever a
      // WIP was rejected, so the transition (and its timeline entry) is only
      // recorded when the status actually moves.
      let commissionStatus = commission.status;
      if (commission.status !== 'IN_PROGRESS') {
        const updated = await tx.commission.update({
          where: { id: commissionId },
          data: { status: 'IN_PROGRESS' },
        });
        commissionStatus = updated.status;
        await tx.commissionEvent.create({
          data: {
            commissionId,
            fromStatus: commission.status,
            toStatus: 'IN_PROGRESS',
            actorId: clientId,
            note: `Changes requested: ${note}`,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: commission.artistId,
          type: 'COMMISSION_CHANGES_REQUESTED',
          data: {
            commissionId,
            deliverableId,
            note,
            revisionCount: revisionCount + 1,
            maxRevisions,
          },
        },
      });

      return {
        deliverable: rejected,
        commissionStatus,
        revisionCount: revisionCount + 1,
        maxRevisions,
        escrowReleased: false,
      };
    }

    // ACCEPT. Only the final artefact can be signed off — accepting a WIP draft
    // would complete the commission before the finished work exists.
    if (deliverable.type !== 'FINAL') {
      throw new AppError(
        'CONFLICT',
        'Only the final deliverable can be accepted — request changes on a work-in-progress draft instead',
      );
    }
    // A FINAL submission always moves the commission to DELIVERED, so a
    // mismatch means the commission was moved out from under this review and
    // completing it would skip the state machine.
    if (commission.status !== 'DELIVERED') {
      throw new AppError(
        'CONFLICT',
        `Cannot accept a deliverable while the commission is ${commission.status}`,
      );
    }

    const accepted = await tx.deliverable.update({
      where: { id: deliverableId },
      data: { status: 'ACCEPTED' },
    });
    const completed = await tx.commission.update({
      where: { id: commissionId },
      data: { status: 'COMPLETED' },
    });
    await tx.commissionEvent.create({
      data: {
        commissionId,
        fromStatus: commission.status,
        toStatus: 'COMPLETED',
        actorId: clientId,
        note: 'Final deliverable accepted; escrow released',
      },
    });

    await tx.notification.create({
      data: {
        userId: commission.artistId,
        type: 'COMMISSION_DELIVERABLE_ACCEPTED',
        data: { commissionId, deliverableId, escrowReleased: true },
      },
    });

    return {
      deliverable: accepted,
      commissionStatus: completed.status,
      revisionCount,
      maxRevisions,
      escrowReleased: true,
    };
  });
}
