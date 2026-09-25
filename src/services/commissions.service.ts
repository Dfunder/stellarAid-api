/** Commission request creation. */

import type { Commission } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

export interface CreateCommissionInput {
  readonly artistId: string;
  readonly title: string;
  readonly description: string;
  readonly budget: number;
  readonly asset: 'USDC' | 'XLM';
  readonly deadline: Date;
}

export async function createCommission(
  clientId: string,
  input: CreateCommissionInput,
): Promise<Commission> {
  if (clientId === input.artistId) {
    throw AppError.badRequest('You cannot create a commission for yourself');
  }

  const artist = await prisma.user.findUnique({
    where: { id: input.artistId },
    select: { id: true, role: true },
  });
  if (artist === null) {
    throw AppError.notFound('Artist not found');
  }
  if (artist.role !== 'ARTIST') {
    throw AppError.unprocessable('The selected user is not an artist');
  }

  return prisma.$transaction(async (tx) => {
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
