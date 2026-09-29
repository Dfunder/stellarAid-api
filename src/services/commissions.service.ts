import type { Asset, Commission, CommissionStatus, Prisma, Role } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

export interface CreateCommissionInput {
  readonly artistId: string;
  readonly title: string;
  readonly description: string;
  readonly budget: number;
  readonly asset: Asset;
  readonly deadline: Date;
}

/**
 * A client requests work from an artist: rejects self-commissions and
 * recipients who aren't artists, then creates the PENDING commission and
 * notifies the artist in one transaction.
 */
export async function createCommission(
  clientId: string,
  input: CreateCommissionInput,
): Promise<Commission> {
  if (clientId === input.artistId) {
    throw new AppError('BAD_REQUEST', 'You cannot create a commission for yourself');
  }

  const artist = await prisma.user.findUnique({
    where: { id: input.artistId },
    select: { id: true, role: true },
  });
  if (artist === null) {
    throw new AppError('NOT_FOUND', 'Artist not found');
  }
  if (artist.role !== 'ARTIST') {
    throw new AppError('UNPROCESSABLE_ENTITY', 'The selected user is not an artist');
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const commission = await tx.commission.create({
      data: {
        clientId,
        artistId: input.artistId,
        title: input.title,
        description: input.description,
        budget: input.budget,
        asset: input.asset,
        deadline: input.deadline,
        status: 'PENDING',
      },
    });

    await tx.notification.create({
      data: {
        userId: input.artistId,
        type: 'COMMISSION_REQUEST',
        data: { commissionId: commission.id, clientId, title: input.title },
      },
    });

    return commission;
  });
}

export interface CommissionReviewInput {
  readonly rating: number;
  readonly title?: string;
  readonly body: string;
}

export interface UpdateCommissionStatusInput {
  readonly status: CommissionStatus;
  readonly review?: CommissionReviewInput;
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

  if (input.status === 'CANCELLED') {
    if (!CANCELLABLE_STATUSES.includes(commission.status)) {
      throw new AppError('CONFLICT', 'This commission can no longer be cancelled');
    }
    return isArtist ? 'artist' : 'client';
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
