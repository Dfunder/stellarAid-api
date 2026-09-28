/**
 * Admin review moderation (#834).
 */

import type { Review, ReviewReport } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services/prisma.service';
import { recalculateArtistAverageRating } from '@/services/reviews.service';

export type ModerationAction = 'approve' | 'remove';

export interface ReportedReviewRow {
  report: ReviewReport;
  review: Review;
}

export async function listReportedReviews(options?: {
  status?: 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
  limit?: number;
  offset?: number;
}): Promise<{ items: ReportedReviewRow[]; total: number }> {
  const status = options?.status ?? 'OPEN';
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  const where = { status: status as 'OPEN' };
  const [total, reports] = await Promise.all([
    prisma.reviewReport.count({ where }),
    prisma.reviewReport.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
      include: { review: true },
    }),
  ]);

  return {
    total,
    items: reports.map((r) => ({
      report: {
        id: r.id,
        reviewId: r.reviewId,
        reporterId: r.reporterId,
        reason: r.reason,
        note: r.note,
        status: r.status,
        outcome: r.outcome,
        moderatorId: r.moderatorId,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
      } as ReviewReport,
      review: r.review,
    })),
  };
}

export async function moderateReview(
  reviewId: string,
  moderatorId: string,
  action: ModerationAction,
  note?: string,
): Promise<{ review: Review; reportsUpdated: number }> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (review === null) {
    throw new AppError('NOT_FOUND', 'Review not found');
  }
  if (action !== 'approve' && action !== 'remove') {
    throw new AppError('BAD_REQUEST', 'action must be approve or remove');
  }

  const visibility = action === 'remove' ? 'REMOVED' : 'VISIBLE';
  const outcome = action === 'remove' ? 'REMOVED' : 'APPROVED';
  const now = new Date();

  const [updatedReview, reportsResult] = await prisma.$transaction([
    prisma.review.update({
      where: { id: reviewId },
      data: { visibility },
    }),
    prisma.reviewReport.updateMany({
      where: {
        reviewId,
        status: { in: ['OPEN', 'REVIEWING'] },
      },
      data: {
        status: action === 'remove' ? 'RESOLVED' : 'DISMISSED',
        outcome,
        moderatorId,
        resolvedAt: now,
      },
    }),
  ]);

  // Notify reporters of the outcome (#834).
  const reports = await prisma.reviewReport.findMany({
    where: { reviewId, resolvedAt: now },
  });
  if (reports.length > 0) {
    await prisma.notification.createMany({
      data: reports.map((r) => ({
        userId: r.reporterId,
        type: 'REVIEW_MODERATION_OUTCOME',
        data: {
          reviewId,
          reportId: r.id,
          outcome,
          note: note ?? null,
        },
      })),
    });
  }

  if (action === 'remove' || review.visibility === 'REMOVED') {
    await recalculateArtistAverageRating(review.targetId);
  }

  return { review: updatedReview, reportsUpdated: reportsResult.count };
}
