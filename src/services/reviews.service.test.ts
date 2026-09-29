import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
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
    order: { findUnique: vi.fn() },
    commission: { findUnique: vi.fn() },
  };
  return { prismaMock: prisma };
});

vi.mock('@/services/prisma.service', () => ({ prisma: prismaMock }));
vi.mock('@/services/cache.service', () => ({
  cached: (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
  invalidateNamespace: vi.fn(),
}));

import { invalidateNamespace } from '@/services/cache.service';

import {
  computeRatingSummary,
  createReview,
  editReview,
  getCachedRatingSummary,
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

function completedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    buyerId: BUYER_ID,
    sellerId: ARTIST_ID,
    status: 'COMPLETED',
    ...overrides,
  };
}

function completedCommission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    clientId: BUYER_ID,
    artistId: ARTIST_ID,
    status: 'COMPLETED',
    ...overrides,
  };
}

describe('createReview (#831, #836)', () => {
  it('derives the reviewed artist from a completed order', async () => {
    prismaMock.order.findUnique.mockResolvedValue(completedOrder());
    prismaMock.review.findUnique.mockResolvedValue(null);
    prismaMock.review.create.mockResolvedValue({
      id: 'r1',
      authorId: BUYER_ID,
      targetId: ARTIST_ID,
      orderId: 'o1',
      rating: 5,
      body: 'Great',
      title: null,
      edited: false,
      createdAt: new Date(),
    });

    const review = await createReview(BUYER_ID, {
      orderId: 'o1',
      // A hostile/incorrect targetId is ignored in favour of the seller.
      targetId: 'someone-else',
      rating: 5,
      body: 'Great',
    });

    expect(review.rating).toBe(5);
    expect(prismaMock.review.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ targetId: ARTIST_ID }) }),
    );
  });

  it('derives the reviewed artist from a completed commission', async () => {
    prismaMock.commission.findUnique.mockResolvedValue(completedCommission());
    prismaMock.review.findUnique.mockResolvedValue(null);
    prismaMock.review.create.mockResolvedValue({
      id: 'r2',
      authorId: BUYER_ID,
      targetId: ARTIST_ID,
      commissionId: 'c1',
      rating: 4,
      body: 'Solid',
    });

    await createReview(BUYER_ID, { commissionId: 'c1', rating: 4, body: 'Solid' });

    expect(prismaMock.review.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ targetId: ARTIST_ID }) }),
    );
  });

  it('rejects a review from a user who is not the buyer', async () => {
    prismaMock.order.findUnique.mockResolvedValue(completedOrder());

    await expect(
      createReview('someone-else', { orderId: 'o1', rating: 5, body: 'not mine' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it('rejects a review of an order that is not completed', async () => {
    prismaMock.order.findUnique.mockResolvedValue(completedOrder({ status: 'PENDING' }));

    await expect(
      createReview(BUYER_ID, { orderId: 'o1', rating: 5, body: 'too early' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a review for an unknown order', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(
      createReview(BUYER_ID, { orderId: 'nope', rating: 5, body: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects a commission review from a user who is not the client', async () => {
    prismaMock.commission.findUnique.mockResolvedValue(completedCommission());

    await expect(
      createReview(ARTIST_ID, { commissionId: 'c1', rating: 5, body: 'self review' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects rating outside 1–5', async () => {
    await expect(
      createReview(BUYER_ID, { orderId: 'o1', rating: 6, body: 'x' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('enforces one-review-per-order', async () => {
    prismaMock.order.findUnique.mockResolvedValue(completedOrder());
    prismaMock.review.findUnique.mockResolvedValue({ id: 'existing' } as never);

    await expect(
      createReview(BUYER_ID, { orderId: 'o1', rating: 4, body: 'dup' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it('enforces one-review-per-order against concurrent duplicates (P2002)', async () => {
    prismaMock.order.findUnique.mockResolvedValue(completedOrder());
    prismaMock.review.findUnique.mockResolvedValue(null);
    prismaMock.review.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      createReview(BUYER_ID, { orderId: 'o1', rating: 4, body: 'dup' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refreshes the artist average rating as part of creation', async () => {
    prismaMock.order.findUnique.mockResolvedValue(completedOrder());
    prismaMock.review.findUnique.mockResolvedValue(null);
    prismaMock.review.create.mockResolvedValue({
      id: 'r3',
      authorId: BUYER_ID,
      targetId: ARTIST_ID,
      orderId: 'o1',
      rating: 5,
      body: 'Great',
    });
    // The cache mock calls the fetcher directly, so this is the post-create
    // read: the new review is already part of the distribution.
    prismaMock.review.groupBy.mockResolvedValue([{ rating: 5, _count: { rating: 1 } }]);

    await createReview(BUYER_ID, { orderId: 'o1', rating: 5, body: 'Great' });
    const summary = await getCachedRatingSummary(ARTIST_ID);

    expect(invalidateNamespace).toHaveBeenCalledWith('reviews');
    expect(summary.average).toBe(5);
    expect(summary.count).toBe(1);
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
