import { describe, expect, it } from 'vitest';

import {
  commissionBodySchema,
  commissionDisputeBodySchema,
  commissionDisputeListQuerySchema,
  commissionDisputeResolveBodySchema,
  commissionListQuerySchema,
  commissionStatusBodySchema,
} from './feature.schemas';

const ARTIST_ID = '3f1d1e2c-6c1a-4f2b-9b1e-2a7c8d4e5f60';
const CLIENT_ID = '7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d';
const FUTURE = '2027-01-01T00:00:00.000Z';

describe('commissionBodySchema (commission creation)', () => {
  const valid = {
    artistId: ARTIST_ID,
    title: 'Album cover',
    description: 'A painted cover for an upcoming album.',
    budget: 250,
    asset: 'USDC',
    deadline: FUTURE,
  };

  it('accepts a complete request and coerces the budget and deadline', () => {
    const parsed = commissionBodySchema.parse({ ...valid, budget: '250' });

    expect(parsed.budget).toBe(250);
    expect(parsed.deadline).toBeInstanceOf(Date);
    expect(parsed.deadline.getTime()).toBeGreaterThan(Date.now());
  });

  it('trims the title and description', () => {
    const parsed = commissionBodySchema.parse({
      ...valid,
      title: '  Album cover  ',
      description: '  A painted cover.  ',
    });

    expect(parsed.title).toBe('Album cover');
    expect(parsed.description).toBe('A painted cover.');
  });

  it('strips unknown keys so the client id can only come from the token', () => {
    const parsed = commissionBodySchema.parse({ ...valid, clientId: CLIENT_ID });

    expect(parsed).not.toHaveProperty('clientId');
  });

  it('requires a UUID artist', () => {
    expect(commissionBodySchema.safeParse({ ...valid, artistId: 'not-a-uuid' }).success).toBe(
      false,
    );
    const { artistId: _omitted, ...withoutArtist } = valid;
    expect(commissionBodySchema.safeParse(withoutArtist).success).toBe(false);
  });

  it('requires a non-empty title and description', () => {
    expect(commissionBodySchema.safeParse({ ...valid, title: '   ' }).success).toBe(false);
    expect(commissionBodySchema.safeParse({ ...valid, description: '' }).success).toBe(false);
  });

  it('rejects a budget that is not a positive finite number', () => {
    for (const budget of [0, -10, 'free', Number.POSITIVE_INFINITY]) {
      expect(commissionBodySchema.safeParse({ ...valid, budget }).success).toBe(false);
    }
  });

  it('rejects an unsupported asset', () => {
    expect(commissionBodySchema.safeParse({ ...valid, asset: 'BTC' }).success).toBe(false);
  });

  it('rejects a deadline in the past', () => {
    const result = commissionBodySchema.safeParse({
      ...valid,
      deadline: '2020-01-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Deadline must be in the future.');
  });
});

describe('commissionStatusBodySchema (status transitions)', () => {
  it.each(['ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'DISPUTED', 'CANCELLED'])(
    'accepts %s without a review',
    (status) => {
      expect(commissionStatusBodySchema.safeParse({ status }).success).toBe(true);
    },
  );

  it('rejects PENDING, which is only ever the initial state', () => {
    expect(commissionStatusBodySchema.safeParse({ status: 'PENDING' }).success).toBe(false);
  });

  it('requires a review when the client completes the commission', () => {
    const result = commissionStatusBodySchema.safeParse({ status: 'COMPLETED' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['review'],
      message: 'A review is required when completing a commission.',
    });
  });

  it('accepts COMPLETED with a valid review', () => {
    const parsed = commissionStatusBodySchema.parse({
      status: 'COMPLETED',
      review: { rating: 5, title: 'Great', body: 'Excellent work' },
    });

    expect(parsed.review?.rating).toBe(5);
  });

  it('rejects a rating outside 1-5', () => {
    for (const rating of [0, 6, 4.5]) {
      expect(
        commissionStatusBodySchema.safeParse({
          status: 'COMPLETED',
          review: { rating, body: 'ok' },
        }).success,
      ).toBe(false);
    }
  });

  it('rejects an empty review body', () => {
    expect(
      commissionStatusBodySchema.safeParse({
        status: 'COMPLETED',
        review: { rating: 5, body: '' },
      }).success,
    ).toBe(false);
  });
});

describe('commissionListQuerySchema', () => {
  it('defaults to page 1, limit 20, newest first and the caller role view', () => {
    expect(commissionListQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 20,
      sort: 'newest',
    });
  });

  it('coerces page and limit from query strings', () => {
    expect(commissionListQuerySchema.parse({ page: '3', limit: '50' })).toMatchObject({
      page: 3,
      limit: 50,
    });
  });

  it('rejects a limit above the maximum', () => {
    expect(commissionListQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('rejects an unknown status or view', () => {
    expect(commissionListQuerySchema.safeParse({ status: 'REFUNDED' }).success).toBe(false);
    expect(commissionListQuerySchema.safeParse({ view: 'admin' }).success).toBe(false);
  });

  it('rejects a `from` date after `to`', () => {
    const result = commissionListQuerySchema.safeParse({
      from: '2026-09-30T00:00:00.000Z',
      to: '2026-09-01T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['from']);
  });
});

describe('commission dispute schemas', () => {
  it('requires a reason when raising a dispute', () => {
    expect(commissionDisputeBodySchema.safeParse({}).success).toBe(false);
    expect(commissionDisputeBodySchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(commissionDisputeBodySchema.safeParse({ reason: 'Never delivered' }).success).toBe(true);
  });

  it('accepts free-form evidence alongside the reason', () => {
    const parsed = commissionDisputeBodySchema.parse({
      reason: 'Never delivered',
      evidence: { screenshot: 'https://example.com/1.png' },
    });

    expect(parsed.evidence).toEqual({ screenshot: 'https://example.com/1.png' });
  });

  it('only accepts the three admin decisions', () => {
    for (const decision of ['RELEASE_TO_ARTIST', 'REFUND_CLIENT', 'REJECT']) {
      expect(commissionDisputeResolveBodySchema.safeParse({ decision }).success).toBe(true);
    }
    expect(commissionDisputeResolveBodySchema.safeParse({ decision: 'REFUND' }).success).toBe(
      false,
    );
    expect(commissionDisputeResolveBodySchema.safeParse({}).success).toBe(false);
  });

  it('only accepts real dispute statuses as a filter', () => {
    expect(commissionDisputeListQuerySchema.safeParse({}).success).toBe(true);
    expect(commissionDisputeListQuerySchema.safeParse({ status: 'OPEN' }).success).toBe(true);
    expect(commissionDisputeListQuerySchema.safeParse({ status: 'PENDING' }).success).toBe(false);
  });

  it('accepts a resolution note with the decision', () => {
    const parsed = commissionDisputeResolveBodySchema.parse({
      decision: 'REFUND_CLIENT',
      resolution: 'Deliverable never arrived.',
    });

    expect(parsed.resolution).toBe('Deliverable never arrived.');
  });
});
