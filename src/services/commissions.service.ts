import type {
  Asset,
  Commission,
  CommissionStatus,
  Deliverable,
  Prisma,
  Review,
  Role,
} from '@prisma/client';

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

/** Public shape of a commission participant (never the password hash). */
export interface CommissionParty {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly role: Role;
}

export type CommissionTimelineType = 'CREATED' | 'STATUS_CHANGED';

/** One entry in a commission's timeline, oldest first. */
export interface CommissionTimelineEntry {
  readonly id: string;
  readonly type: CommissionTimelineType;
  readonly fromStatus: CommissionStatus | null;
  readonly toStatus: CommissionStatus;
  readonly actorId: string | null;
  readonly note: string | null;
  readonly at: Date;
}

export type CommissionView = 'client' | 'artist';
export type CommissionSort = 'newest' | 'oldest';

export interface ListCommissionsQuery {
  readonly view?: CommissionView;
  readonly status?: CommissionStatus;
  readonly from?: Date;
  readonly to?: Date;
  readonly sort: CommissionSort;
  readonly page: number;
  readonly limit: number;
}

/** A commission plus the public identity of both parties. */
export interface CommissionListItem extends Commission {
  readonly client: CommissionParty | null;
  readonly artist: CommissionParty | null;
}

export interface PaginatedCommissions {
  readonly data: readonly CommissionListItem[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly hasNext: boolean;
}

export interface CommissionDetail {
  readonly commission: Commission;
  readonly parties: {
    readonly client: CommissionParty | null;
    readonly artist: CommissionParty | null;
  };
  readonly deliverables: readonly Deliverable[];
  readonly reviews: readonly Review[];
  readonly timeline: readonly CommissionTimelineEntry[];
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

    const updated = await tx.commission.update({
      where: { id: commissionId },
      data: { status: input.status },
    });

    // Append-only audit trail — the detail endpoint builds its timeline from
    // these rows, so every transition is recorded in the same transaction.
    await tx.commissionEvent.create({
      data: {
        commissionId,
        fromStatus: commission.status,
        toStatus: input.status,
        actorId: userId,
      },
    });

    return updated;
  });
}

async function loadParties(userIds: readonly string[]): Promise<Map<string, CommissionParty>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) {
    return new Map();
  }
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, username: true, role: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

function canView(commission: Commission, userId: string, role: Role): boolean {
  return commission.clientId === userId || commission.artistId === userId || role === 'ADMIN';
}

/**
 * Commissions the caller requested (`view=client`) or received
 * (`view=artist`), newest first by default. `view` defaults to the caller's
 * role so each side sees only its own side of the marketplace.
 */
export async function listCommissionsForUser(
  userId: string,
  role: Role,
  query: ListCommissionsQuery,
): Promise<PaginatedCommissions> {
  const view: CommissionView = query.view ?? (role === 'ARTIST' ? 'artist' : 'client');
  const where: Prisma.CommissionWhereInput = {
    ...(view === 'client' ? { clientId: userId } : { artistId: userId }),
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.from !== undefined || query.to !== undefined
      ? {
          createdAt: {
            ...(query.from !== undefined ? { gte: query.from } : {}),
            ...(query.to !== undefined ? { lte: query.to } : {}),
          },
        }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [total, rows] = await Promise.all([
    prisma.commission.count({ where }),
    prisma.commission.findMany({
      where,
      orderBy: { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' },
      skip,
      take: query.limit,
    }),
  ]);

  const parties = await loadParties(rows.flatMap((row) => [row.clientId, row.artistId]));

  return {
    data: rows.map((row) => ({
      ...row,
      client: parties.get(row.clientId) ?? null,
      artist: parties.get(row.artistId) ?? null,
    })),
    page: query.page,
    limit: query.limit,
    total,
    hasNext: skip + rows.length < total,
  };
}

/**
 * Full commission read model: parties, deliverables, reviews and the
 * status timeline. Only the client, the artist or an admin may read it.
 */
export async function getCommissionDetail(
  commissionId: string,
  userId: string,
  role: Role,
): Promise<CommissionDetail> {
  const commission = await prisma.commission.findUnique({ where: { id: commissionId } });
  if (commission === null) {
    throw new AppError('NOT_FOUND', 'Commission not found');
  }
  if (!canView(commission, userId, role)) {
    throw new AppError(
      'FORBIDDEN',
      'Only the client, the artist or an admin can view this commission',
    );
  }

  const [events, deliverables, reviews, parties] = await Promise.all([
    prisma.commissionEvent.findMany({
      where: { commissionId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.deliverable.findMany({ where: { commissionId }, orderBy: { createdAt: 'asc' } }),
    prisma.review.findMany({ where: { commissionId }, orderBy: { createdAt: 'asc' } }),
    loadParties([commission.clientId, commission.artistId]),
  ]);

  const timeline: CommissionTimelineEntry[] = [
    {
      id: `${commission.id}:created`,
      type: 'CREATED',
      fromStatus: null,
      toStatus: 'PENDING',
      actorId: commission.clientId,
      note: null,
      at: commission.createdAt,
    },
    ...events.map((event): CommissionTimelineEntry => ({
      id: event.id,
      type: 'STATUS_CHANGED',
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorId: event.actorId,
      note: event.note,
      at: event.createdAt,
    })),
  ];
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    commission,
    parties: {
      client: parties.get(commission.clientId) ?? null,
      artist: parties.get(commission.artistId) ?? null,
    },
    deliverables,
    reviews,
    timeline,
  };
}
