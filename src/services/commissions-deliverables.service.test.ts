import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    commission: { findUnique: vi.fn(), update: vi.fn() },
    deliverable: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    commissionEvent: { create: vi.fn() },
    notification: { create: vi.fn() },
    review: { create: vi.fn() },
  };
  return {
    txMock: tx,
    prismaMock: {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import { cancelCommission, reviewDeliverable, submitDeliverable } from './commissions.service';

const COMMISSION_ID = 'commission-1';
const DELIVERABLE_ID = 'deliverable-1';
const CLIENT_ID = 'client-1';
const ARTIST_ID = 'artist-1';

function makeCommission(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: COMMISSION_ID,
    clientId: CLIENT_ID,
    artistId: ARTIST_ID,
    status: 'ACCEPTED',
    revisionCount: 0,
    escrowFunded: false,
    budget: new Prisma.Decimal('100.00'),
    asset: 'XLM',
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  txMock.commission.findUnique.mockResolvedValue(makeCommission());
  txMock.commission.update.mockResolvedValue(makeCommission());
  txMock.deliverable.create.mockResolvedValue({ id: DELIVERABLE_ID, status: 'SUBMITTED' });
  txMock.deliverable.findUnique.mockResolvedValue({
    id: DELIVERABLE_ID,
    commissionId: COMMISSION_ID,
    status: 'SUBMITTED',
  });
  txMock.deliverable.update.mockResolvedValue({ id: DELIVERABLE_ID });
  txMock.commissionEvent.create.mockResolvedValue({ id: 'event-1' });
  txMock.notification.create.mockResolvedValue({ id: 'notification-1' });
});

describe('submitDeliverable', () => {
  it('lets the artist submit a FINAL deliverable and moves the commission to DELIVERED', async () => {
    await submitDeliverable(COMMISSION_ID, ARTIST_ID, {
      type: 'FINAL',
      note: 'Final piece attached',
      mediaIds: ['media-1', 'media-2'],
    });

    expect(txMock.deliverable.create).toHaveBeenCalledWith({
      data: {
        commissionId: COMMISSION_ID,
        note: 'Final piece attached',
        type: 'FINAL',
        status: 'SUBMITTED',
        revision: 1,
        mediaIds: ['media-1', 'media-2'],
      },
    });
    expect(txMock.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'DELIVERED' },
    });
    expect(txMock.commissionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'DELIVERABLE_SUBMITTED' }),
      }),
    );
    expect(txMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: CLIENT_ID,
          type: 'commission.deliverable_submitted',
        }),
      }),
    );
  });

  it('keeps the commission in progress for a WIP submission', async () => {
    await submitDeliverable(COMMISSION_ID, ARTIST_ID, { type: 'WIP' });

    expect(txMock.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'IN_PROGRESS' },
    });
  });

  it('rejects a submission from someone other than the assigned artist', async () => {
    await expect(
      submitDeliverable(COMMISSION_ID, CLIENT_ID, { type: 'FINAL' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(txMock.deliverable.create).not.toHaveBeenCalled();
  });

  it('rejects a submission while the commission is not submittable', async () => {
    txMock.commission.findUnique.mockResolvedValue(makeCommission({ status: 'PENDING' }));

    await expect(
      submitDeliverable(COMMISSION_ID, ARTIST_ID, { type: 'FINAL' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('reviewDeliverable', () => {
  beforeEach(() => {
    txMock.commission.findUnique.mockResolvedValue(
      makeCommission({ status: 'DELIVERED', escrowFunded: true }),
    );
  });

  it('accepts the deliverable, completes the commission and releases escrow', async () => {
    txMock.deliverable.update.mockResolvedValue({ id: DELIVERABLE_ID, status: 'ACCEPTED' });
    txMock.commission.update.mockResolvedValue(makeCommission({ status: 'COMPLETED' }));

    const result = await reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, {
      decision: 'ACCEPT',
    });

    expect(result.deliverable.status).toBe('ACCEPTED');
    expect(result.commission.status).toBe('COMPLETED');
    expect(txMock.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'COMPLETED', escrowReleasedAt: expect.any(Date) },
    });
    expect(txMock.commissionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'ESCROW_RELEASED' }) }),
    );
    expect(txMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: ARTIST_ID,
          type: 'commission.deliverable_accepted',
        }),
      }),
    );
  });

  it('requesting changes requires feedback and increments the revision count', async () => {
    await reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, {
      decision: 'REQUEST_CHANGES',
      feedback: 'Please adjust the lighting',
    });

    expect(txMock.deliverable.update).toHaveBeenCalledWith({
      where: { id: DELIVERABLE_ID },
      data: {
        status: 'REJECTED',
        reviewedAt: expect.any(Date),
        feedback: 'Please adjust the lighting',
      },
    });
    expect(txMock.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'IN_PROGRESS', revisionCount: 1 },
    });
    expect(txMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: ARTIST_ID,
          type: 'commission.changes_requested',
        }),
      }),
    );
  });

  it('rejects a change request without feedback', async () => {
    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, {
        decision: 'REQUEST_CHANGES',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('enforces the maximum number of revisions', async () => {
    txMock.commission.findUnique.mockResolvedValue(
      makeCommission({ status: 'DELIVERED', revisionCount: 3 }),
    );

    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, {
        decision: 'REQUEST_CHANGES',
        feedback: 'one more tweak',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects a review from someone other than the client', async () => {
    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, ARTIST_ID, { decision: 'ACCEPT' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects reviewing a deliverable that is not awaiting review', async () => {
    txMock.deliverable.findUnique.mockResolvedValue({
      id: DELIVERABLE_ID,
      commissionId: COMMISSION_ID,
      status: 'ACCEPTED',
    });

    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, { decision: 'ACCEPT' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('cancelCommission', () => {
  it('lets either party cancel, refunds a funded escrow and notifies both parties', async () => {
    txMock.commission.findUnique.mockResolvedValue(
      makeCommission({ status: 'IN_PROGRESS', escrowFunded: true }),
    );

    const result = await cancelCommission(COMMISSION_ID, CLIENT_ID, { reason: 'Budget changed' });

    expect(result.refunded).toBe(true);
    expect(txMock.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: {
        status: 'CANCELLED',
        cancelReason: 'Budget changed',
        cancelledAt: expect.any(Date),
        cancelledById: CLIENT_ID,
        escrowRefundedAt: expect.any(Date),
      },
    });
    const eventTypes = txMock.commissionEvent.create.mock.calls.map(
      (call) => (call[0] as { data: { type: string } }).data.type,
    );
    expect(eventTypes).toContain('CANCELLED');
    expect(eventTypes).toContain('ESCROW_REFUNDED');
    expect(txMock.notification.create).toHaveBeenCalledTimes(2);
  });

  it('does not refund when the commission was never funded', async () => {
    const result = await cancelCommission(COMMISSION_ID, ARTIST_ID, { reason: 'No longer able' });

    expect(result.refunded).toBe(false);
    expect(txMock.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: {
        status: 'CANCELLED',
        cancelReason: 'No longer able',
        cancelledAt: expect.any(Date),
        cancelledById: ARTIST_ID,
      },
    });
  });

  it('rejects cancellation once the commission has been delivered', async () => {
    txMock.commission.findUnique.mockResolvedValue(makeCommission({ status: 'DELIVERED' }));

    await expect(
      cancelCommission(COMMISSION_ID, CLIENT_ID, { reason: 'changed my mind' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects a non-participant', async () => {
    await expect(
      cancelCommission(COMMISSION_ID, 'stranger', { reason: 'not involved' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('requires a non-empty reason', async () => {
    await expect(
      cancelCommission(COMMISSION_ID, CLIENT_ID, { reason: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
