import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    order: { findUnique: vi.fn() },
    commission: { findUnique: vi.fn() },
    review: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    reviewReport: {
      create: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prismaMock: prisma };
});

vi.mock('@/services/prisma.service', () => ({ prisma: prismaMock }));
vi.mock('@/services/cache.service', () => ({
  cached: (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
  invalidateNamespace: vi.fn(),
}));

import {
  computeRatingSummary,
  createReview,
  editReview,
  listReviewsForUsername,
  moderateReport,
  reportReview,
  REVIEW_EDIT_WINDOW_MS,
  REVIEW_REPORTS_PER_DAY,
} from './reviews.service';

beforeEach(() => {
  vi.clearAllMocks();
});

const BUYER_ID = 'buyer-1';
const ARTIST_ID = 'artist-1';
const ORDER_ID = 'order-1';

describe('createReview (#831/#836)', () => {
  beforeEach(() => {
    prismaMock.order.findUnique.mockResolvedValue({
      buyerId: BUYER_ID,
      sellerId: ARTIST_ID,
      status: 'COMPLETED',
    });
    prismaMock.commission.findUnique.mockResolvedValue({
      clientId: BUYER_ID,
      artistId: ARTIST_ID,
      status: 'COMPLETED',
    });
    prismaMock.review.groupBy.mockResolvedValue([{ rating: 5, _count: { rating: 1 } }]);
  });

  it('creates a review with valid rating and returns the recalculated average', async () => {
    prismaMock.review.create.mockResolvedValue({
      id: 'r1',
      authorId: BUYER_ID,
      targetId: ARTIST_ID,
      orderId: ORDER_ID,
      rating: 5,
      body: 'Great',
      title: null,
      edited: false,
      createdAt: new Date(),
    });
    const { review, summary } = await createReview(BUYER_ID, {
      orderId: ORDER_ID,
      targetId: ARTIST_ID,
      rating: 5,
      body: 'Great',
    });
    expect(review.rating).toBe(5);
    expect(prismaMock.review.create).toHaveBeenCalled();
    expect(summary).toMatchObject({ average: 5, count: 1 });
  });

  it('rejects rating outside 1–5', async () => {
    await expect(
      createReview(BUYER_ID, { orderId: ORDER_ID, targetId: ARTIST_ID, rating: 6, body: 'x' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('enforces one-review-per-order on unique violation', async () => {
    prismaMock.review.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      createReview(BUYER_ID, {
        orderId: ORDER_ID,
        targetId: ARTIST_ID,
        rating: 4,
        body: 'dup',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects a review of an order that is not completed', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      buyerId: BUYER_ID,
      sellerId: ARTIST_ID,
      status: 'PROCESSING',
    });
    await expect(
      createReview(BUYER_ID, { orderId: ORDER_ID, targetId: ARTIST_ID, rating: 5, body: 'x' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it('rejects a review by someone other than the buyer', async () => {
    await expect(
      createReview('stranger', {
        orderId: ORDER_ID,
        targetId: ARTIST_ID,
        rating: 5,
        body: 'x',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a target that is not the seller on the order', async () => {
    await expect(
      createReview(BUYER_ID, {
        orderId: ORDER_ID,
        targetId: 'someone-else',
        rating: 5,
        body: 'x',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects an unknown order', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    await expect(
      createReview(BUYER_ID, { orderId: ORDER_ID, targetId: ARTIST_ID, rating: 5, body: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lets the client review its completed commission for the artist', async () => {
    prismaMock.review.create.mockResolvedValue({
      id: 'r2',
      authorId: BUYER_ID,
      targetId: ARTIST_ID,
      commissionId: 'commission-1',
      rating: 4,
      body: 'Nice work',
      title: null,
      edited: false,
      createdAt: new Date(),
    });
    prismaMock.review.groupBy.mockResolvedValue([{ rating: 4, _count: { rating: 1 } }]);

    const { summary } = await createReview(BUYER_ID, {
      commissionId: 'commission-1',
      targetId: ARTIST_ID,
      rating: 4,
      body: 'Nice work',
    });
    expect(prismaMock.commission.findUnique).toHaveBeenCalledWith({
      where: { id: 'commission-1' },
      select: { clientId: true, artistId: true, status: true },
    });
    expect(summary.average).toBe(4);
  });

  it('rejects a review of an unfinished commission', async () => {
    prismaMock.commission.findUnique.mockResolvedValue({
      clientId: BUYER_ID,
      artistId: ARTIST_ID,
      status: 'DELIVERED',
    });
    await expect(
      createReview(BUYER_ID, {
        commissionId: 'commission-1',
        targetId: ARTIST_ID,
        rating: 5,
        body: 'x',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('editReview edit window (#836)', () => {
  it('rejects edits after the window expires', async () => {
    const old = new Date(Date.now() - REVIEW_EDIT_WINDOW_MS - 1000);
    prismaMock.review.findUnique.mockResolvedValue({
      id: 'r1',
      authorId: 'a1',
      createdAt: old,
    });
    await expect(editReview('r1', 'a1', { body: 'late' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('average rating (#832/#836)', () => {
  it('computes average and distribution from visible reviews', async () => {
    prismaMock.review.groupBy.mockResolvedValue([
      { rating: 5, _count: { rating: 2 } },
      { rating: 4, _count: { rating: 1 } },
    ]);
    const summary = await computeRatingSummary('artist-1');
    expect(summary.count).toBe(3);
    expect(summary.average).toBe(4.67);
    expect(summary.distribution['5']).toBe(2);
  });
});

describe('reportReview (#835)', () => {
  it('records report with reason and returns confirmation', async () => {
    prismaMock.review.findUnique.mockResolvedValue({
      id: 'r1',
      authorId: 'author',
    });
    prismaMock.reviewReport.count.mockResolvedValue(0);
    prismaMock.reviewReport.create.mockResolvedValue({
      id: 'rep1',
      reviewId: 'r1',
      reason: 'spam',
      note: null,
      createdAt: new Date(),
    });
    const result = await reportReview('r1', 'reporter', { reason: 'spam' });
    expect(result.message).toMatch(/received/i);
    expect(result.reason).toBe('spam');
  });

  it('rate-limits reports per user per day', async () => {
    prismaMock.review.findUnique.mockResolvedValue({ id: 'r1', authorId: 'author' });
    prismaMock.reviewReport.count.mockResolvedValue(REVIEW_REPORTS_PER_DAY);
    await expect(reportReview('r1', 'reporter', { reason: 'spam' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });
});

describe('listReviewsForUsername (#832)', () => {
  it('paginates and attaches author identity', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'artist-1' });
    prismaMock.review.count.mockResolvedValue(1);
    prismaMock.review.findMany.mockResolvedValue([
      {
        id: 'r1',
        authorId: 'buyer-1',
        targetId: 'artist-1',
        rating: 5,
        title: null,
        body: 'Nice',
        edited: false,
        createdAt: new Date(),
      },
    ]);
    prismaMock.review.groupBy.mockResolvedValue([{ rating: 5, _count: { rating: 1 } }]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'buyer-1', name: 'Buyer', username: 'buyer' },
    ]);

    const page = await listReviewsForUsername('artist', {
      page: 1,
      limit: 20,
      sort: 'recent',
    });
    expect(page.data).toHaveLength(1);
    expect(page.data[0]!.author.username).toBe('buyer');
    expect(page.summary.average).toBe(5);
  });
});

describe('moderateReport (#836)', () => {
  it('updates report status', async () => {
    prismaMock.reviewReport.findUnique.mockResolvedValue({ id: 'rep1', status: 'OPEN' });
    prismaMock.reviewReport.update.mockResolvedValue({ id: 'rep1', status: 'RESOLVED' });
    const updated = await moderateReport('rep1', 'RESOLVED');
    expect(updated.status).toBe('RESOLVED');
  });
});
