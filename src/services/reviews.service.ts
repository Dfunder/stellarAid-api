/**
 * Reviews service — list, averages, reporting, creation rules (#832, #835, #836).
 */

import type { Prisma, Review, ReviewReport } from '@prisma/client';

import { AppError } from '@/middlewares';
import { cached, invalidateNamespace } from '@/services/cache.service';
import { prisma } from '@/services/prisma.service';

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const REPORTS_PER_DAY = 5;
const AVG_CACHE_TTL_SEC = 300;
const OPEN_REPORT_STATUSES = ['OPEN', 'REVIEWING'] as const;

export type ReviewSort = 'recent' | 'highest' | 'lowest';

export interface ListReviewsQuery {
  page: number;
  limit: number;
  sort: ReviewSort;
}

export interface ReviewAuthor {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  edited: boolean;
  createdAt: Date;
  author: ReviewAuthor;
}

export interface RatingSummary {
  average: number;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface PaginatedReviews {
  data: PublicReview[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  summary: RatingSummary;
}

export interface CreateReviewInput {
  orderId?: string;
  commissionId?: string;
  rating: number;
  title?: string;
  body: string;
  targetId: string;
}

export interface ReportReviewInput {
  reason: string;
  note?: string;
}

function authorSelect() {
  return { id: true, name: true, username: true } as const;
}

function toPublicReview(
  review: Review & { author?: { id: string; name: string; username: string } | null },
): PublicReview {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    edited: review.edited,
    createdAt: review.createdAt,
    author: {
      id: review.author?.id ?? review.authorId,
      name: review.author?.name ?? 'Unknown',
      username: review.author?.username ?? 'unknown',
      avatar: null,
    },
  };
}

/** Reviews with an OPEN/REVIEWING report are hidden from public lists (#832). */
function visibleWhere(targetId: string): Prisma.ReviewWhereInput {
  return {
    targetId,
    NOT: {
      reports: {
        some: {
          status: { in: [...OPEN_REPORT_STATUSES] },
        },
      },
    },
  };
}

function orderBySort(sort: ReviewSort): Prisma.ReviewOrderByWithRelationInput {
  if (sort === 'highest') return { rating: 'desc' };
  if (sort === 'lowest') return { rating: 'asc' };
  return { createdAt: 'desc' };
}

export async function getArtistIdByUsername(username: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (user === null) {
    throw new AppError('NOT_FOUND', 'User not found');
  }
  return user.id;
}

export async function computeRatingSummary(targetId: string): Promise<RatingSummary> {
  const where = visibleWhere(targetId);
  const groups = await prisma.review.groupBy({
    by: ['rating'],
    where,
    _count: { rating: true },
  });

  const distribution: RatingSummary['distribution'] = {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  };
  let total = 0;
  let sum = 0;
  for (const g of groups) {
    const key = String(g.rating) as keyof typeof distribution;
    if (key in distribution) {
      distribution[key] = g._count.rating;
      total += g._count.rating;
      sum += g.rating * g._count.rating;
    }
  }
  const average = total === 0 ? 0 : Math.round((sum / total) * 100) / 100;
  return { average, count: total, distribution };
}

/** Cached average + distribution for an artist (#832). */
export async function getCachedRatingSummary(targetId: string): Promise<RatingSummary> {
  return cached(`reviews:avg:${targetId}`, AVG_CACHE_TTL_SEC, () =>
    computeRatingSummary(targetId),
  );
}

export async function listReviewsForUsername(
  username: string,
  query: ListReviewsQuery,
): Promise<PaginatedReviews> {
  const targetId = await getArtistIdByUsername(username);
  const where = visibleWhere(targetId);
  const skip = (query.page - 1) * query.limit;

  const [total, rows, summary] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: orderBySort(query.sort),
      skip,
      take: query.limit,
    }),
    getCachedRatingSummary(targetId),
  ]);

  // Attach authors (User is not a Prisma relation on Review in schema — load separately)
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: authorSelect(),
  });
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const data = rows.map((r) =>
    toPublicReview({ ...r, author: authorMap.get(r.authorId) ?? null }),
  );

  return {
    data,
    page: query.page,
    limit: query.limit,
    total,
    hasNext: skip + rows.length < total,
    summary,
  };
}

function assertRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError('BAD_REQUEST', 'Rating must be an integer between 1 and 5');
  }
}

/**
 * Create a review for a completed order or commission.
 * Enforces one-review-per-order / per-commission (#836).
 */
export async function createReview(
  authorId: string,
  input: CreateReviewInput,
): Promise<Review> {
  assertRating(input.rating);
  if (!input.body?.trim()) {
    throw new AppError('BAD_REQUEST', 'Review body is required');
  }
  if (!input.orderId && !input.commissionId) {
    throw new AppError('BAD_REQUEST', 'orderId or commissionId is required');
  }
  if (input.orderId && input.commissionId) {
    throw new AppError('BAD_REQUEST', 'Provide either orderId or commissionId, not both');
  }

  try {
    const review = await prisma.review.create({
      data: {
        authorId,
        targetId: input.targetId,
        orderId: input.orderId,
        commissionId: input.commissionId,
        rating: input.rating,
        title: input.title,
        body: input.body.trim(),
      },
    });
    await invalidateNamespace('reviews');
    return review;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      throw new AppError('CONFLICT', 'A review already exists for this order or commission');
    }
    throw err;
  }
}

/**
 * Edit is allowed only within EDIT_WINDOW_MS of creation (#836 edge case).
 */
export async function editReview(
  reviewId: string,
  authorId: string,
  input: { rating?: number; title?: string; body?: string },
): Promise<Review> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (review === null) {
    throw new AppError('NOT_FOUND', 'Review not found');
  }
  if (review.authorId !== authorId) {
    throw new AppError('FORBIDDEN', 'You can only edit your own review');
  }
  const age = Date.now() - review.createdAt.getTime();
  if (age > EDIT_WINDOW_MS) {
    throw new AppError('FORBIDDEN', 'Edit window has expired');
  }
  if (input.rating !== undefined) {
    assertRating(input.rating);
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      rating: input.rating,
      title: input.title,
      body: input.body?.trim(),
      edited: true,
    },
  });
  await invalidateNamespace('reviews');
  return updated;
}

/**
 * Report a review — max REPORTS_PER_DAY per reporter (#835).
 */
export async function reportReview(
  reviewId: string,
  reporterId: string,
  input: ReportReviewInput,
): Promise<{ id: string; reviewId: string; reason: string; note: string | null; createdAt: Date; message: string }> {
  if (!input.reason?.trim()) {
    throw new AppError('BAD_REQUEST', 'Reason is required');
  }

  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (review === null) {
    throw new AppError('NOT_FOUND', 'Review not found');
  }
  if (review.authorId === reporterId) {
    throw new AppError('BAD_REQUEST', 'You cannot report your own review');
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.reviewReport.count({
    where: {
      reporterId,
      createdAt: { gte: dayAgo },
    },
  });
  if (recentCount >= REPORTS_PER_DAY) {
    throw new AppError('RATE_LIMITED', `Maximum ${REPORTS_PER_DAY} reports per day`);
  }

  const report = await prisma.reviewReport.create({
    data: {
      reviewId,
      reporterId,
      reason: input.reason.trim(),
      note: input.note?.trim() || null,
      status: 'OPEN',
    },
  });

  // Hide from public lists while pending moderation — invalidate avg cache
  await invalidateNamespace('reviews');

  return {
    id: report.id,
    reviewId: report.reviewId,
    reason: report.reason,
    note: report.note,
    createdAt: report.createdAt,
    message: 'Thank you. Your report has been received and will be reviewed.',
  };
}

/**
 * Moderation: resolve or dismiss a report (#836).
 */
export async function moderateReport(
  reportId: string,
  status: 'RESOLVED' | 'DISMISSED',
): Promise<ReviewReport> {
  const report = await prisma.reviewReport.findUnique({ where: { id: reportId } });
  if (report === null) {
    throw new AppError('NOT_FOUND', 'Report not found');
  }
  const updated = await prisma.reviewReport.update({
    where: { id: reportId },
    data: { status },
  });
  await invalidateNamespace('reviews');
  return updated;
}

export const REVIEW_EDIT_WINDOW_MS = EDIT_WINDOW_MS;
export const REVIEW_REPORTS_PER_DAY = REPORTS_PER_DAY;
