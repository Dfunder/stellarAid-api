/**
 * Review update/delete (#833) and average-rating maintenance.
 */

import { Prisma, type Review } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services/prisma.service';

export const REVIEW_EDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface UpdateReviewInput {
  readonly rating?: number;
  readonly title?: string | null;
  readonly body?: string;
}

function assertAuthor(review: Review, userId: string): void {
  if (review.authorId !== userId) {
    throw new AppError('FORBIDDEN', 'Only the review author can perform this action');
  }
}

function assertEditWindow(review: Review, now = new Date()): void {
  const age = now.getTime() - review.createdAt.getTime();
  if (age > REVIEW_EDIT_WINDOW_MS) {
    throw new AppError(
      'FORBIDDEN',
      'Reviews can only be edited within 30 days of creation',
    );
  }
}

/** Recalculate and persist artist average from VISIBLE reviews (#833). */
export async function recalculateArtistAverageRating(
  targetUserId: string,
): Promise<{ averageRating: number | null; reviewCount: number }> {
  const agg = await prisma.review.aggregate({
    where: { targetId: targetUserId, visibility: 'VISIBLE' },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const reviewCount = agg._count._all;
  const averageRating =
    reviewCount === 0 || agg._avg.rating === null
      ? null
      : Math.round(agg._avg.rating * 100) / 100;

  await prisma.artistProfile.updateMany({
    where: { userId: targetUserId },
    data: {
      averageRating:
        averageRating === null
          ? null
          : new Prisma.Decimal(averageRating.toFixed(2)),
      reviewCount,
    },
  });

  return { averageRating, reviewCount };
}

export async function updateReview(
  reviewId: string,
  userId: string,
  input: UpdateReviewInput,
): Promise<Review> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (review === null) {
    throw new AppError('NOT_FOUND', 'Review not found');
  }
  if (review.visibility === 'REMOVED') {
    throw new AppError('FORBIDDEN', 'Removed reviews cannot be edited');
  }
  assertAuthor(review, userId);
  assertEditWindow(review);

  if (input.rating !== undefined && (input.rating < 1 || input.rating > 5)) {
    throw new AppError('BAD_REQUEST', 'Rating must be between 1 and 5');
  }
  if (input.body !== undefined && input.body.trim().length === 0) {
    throw new AppError('BAD_REQUEST', 'Review body cannot be empty');
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body.trim() } : {}),
      edited: true,
      editedAt: new Date(),
    },
  });

  if (input.rating !== undefined && input.rating !== review.rating) {
    await recalculateArtistAverageRating(review.targetId);
  }

  return updated;
}

export async function deleteReview(
  reviewId: string,
  userId: string,
): Promise<{ deleted: true; averageRating: number | null; reviewCount: number }> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (review === null) {
    throw new AppError('NOT_FOUND', 'Review not found');
  }
  assertAuthor(review, userId);

  await prisma.review.delete({ where: { id: reviewId } });
  const stats = await recalculateArtistAverageRating(review.targetId);
  return { deleted: true, ...stats };
}

export function toReviewResponse(review: Review) {
  return {
    id: review.id,
    orderId: review.orderId,
    commissionId: review.commissionId,
    authorId: review.authorId,
    targetId: review.targetId,
    rating: review.rating,
    title: review.title,
    body: review.body,
    edited: review.edited,
    /** Badge for clients: show "edited" when true (#833). */
    editedBadge: review.edited,
    editedAt: review.editedAt,
    visibility: review.visibility,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}
