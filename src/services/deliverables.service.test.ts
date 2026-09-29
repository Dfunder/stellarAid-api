import { beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT_ID = 'client-1';
const ARTIST_ID = 'artist-1';
const COMMISSION_ID = 'commission-1';

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    commission: { findUnique: vi.fn(), update: vi.fn() },
    deliverable: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    commissionEvent: { create: vi.fn() },
    commissionDispute: { findFirst: vi.fn() },
    notification: { create: vi.fn() },
    media: { findMany: vi.fn() },
  };
  return {
    txMock: tx,
    prismaMock: {
      // Typed loosely so `tx` isn't referenced in its own annotation.
      $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => callback(tx)),
      tx,
    },
  };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import {
  DELIVERABLE_MAX_MEDIA,
  reviewDeliverable,
  submitDeliverable,
} from './deliverables.service';

const DELIVERABLE_ID = 'deliverable-1';

function makeCommission(status = 'IN_PROGRESS') {
  return {
    id: COMMISSION_ID,
    clientId: CLIENT_ID,
    artistId: ARTIST_ID,
    status,
  };
}

function makeDeliverable(status = 'SUBMITTED', type = 'FINAL') {
  return {
    id: DELIVERABLE_ID,
    commissionId: COMMISSION_ID,
    type,
    status,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  txMock.commission.findUnique.mockResolvedValue(makeCommission());
  txMock.commission.update.mockImplementation(async ({ data }: { data: { status: string } }) =>
    makeCommission(data.status),
  );
  txMock.deliverable.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'deliverable-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      media: [],
    }),
  );
  txMock.commissionEvent.create.mockResolvedValue({ id: 'event-1' });
  txMock.notification.create.mockResolvedValue({ id: 'notification-1' });
  txMock.media.findMany.mockResolvedValue([{ id: 'media-1' }]);
  txMock.deliverable.findUnique.mockResolvedValue(makeDeliverable());
  txMock.deliverable.update.mockImplementation(async ({ data }: { data: { status: string } }) =>
    makeDeliverable(data.status),
  );
  txMock.deliverable.count.mockResolvedValue(0);
  // No open dispute unless a test asks for one.
  txMock.commissionDispute.findFirst.mockResolvedValue(null);
});

describe('submitDeliverable (#784)', () => {
  it('records a FINAL submission, moves the commission to DELIVERED and notifies the client', async () => {
    const result = await submitDeliverable(COMMISSION_ID, ARTIST_ID, {
      type: 'FINAL',
      note: '  Final files attached.  ',
    });

    expect(txMock.deliverable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commissionId: COMMISSION_ID,
          type: 'FINAL',
          status: 'SUBMITTED',
          note: 'Final files attached.',
        }),
      }),
    );
    expect(result.commissionStatus).toBe('DELIVERED');

    // The transition is on the audit trail, attributed to the artist.
    expect(txMock.commissionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        commissionId: COMMISSION_ID,
        fromStatus: 'IN_PROGRESS',
        toStatus: 'DELIVERED',
        actorId: ARTIST_ID,
      }),
    });

    expect(txMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: CLIENT_ID,
        type: 'COMMISSION_DELIVERABLE_SUBMITTED',
        data: expect.objectContaining({ deliverableId: 'deliverable-1', type: 'FINAL' }),
      }),
    });
  });

  it('records a WIP draft without completing anything', async () => {
    const result = await submitDeliverable(COMMISSION_ID, ARTIST_ID, {
      type: 'WIP',
      note: 'Rough composition.',
    });

    // Already IN_PROGRESS, so there is no transition to record.
    expect(result.commissionStatus).toBe('IN_PROGRESS');
    expect(txMock.commission.update).not.toHaveBeenCalled();
    expect(txMock.commissionEvent.create).not.toHaveBeenCalled();
    expect(txMock.notification.create).toHaveBeenCalled();
  });

  it('moves an ACCEPTED commission to IN_PROGRESS on the first WIP submission', async () => {
    txMock.commission.findUnique.mockResolvedValue(makeCommission('ACCEPTED'));

    const result = await submitDeliverable(COMMISSION_ID, ARTIST_ID, { type: 'WIP' });

    expect(result.commissionStatus).toBe('IN_PROGRESS');
    expect(txMock.commissionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fromStatus: 'ACCEPTED', toStatus: 'IN_PROGRESS' }),
    });
  });

  it('attaches media that belongs to the artist, preserving order', async () => {
    txMock.media.findMany.mockResolvedValue([{ id: 'media-1' }, { id: 'media-2' }]);

    await submitDeliverable(COMMISSION_ID, ARTIST_ID, {
      type: 'FINAL',
      mediaIds: ['media-1', 'media-2'],
    });

    expect(txMock.media.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['media-1', 'media-2'] }, userId: ARTIST_ID },
      select: { id: true },
    });
    expect(txMock.deliverable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          media: {
            create: [
              { mediaId: 'media-1', sort: 0 },
              { mediaId: 'media-2', sort: 1 },
            ],
          },
        }),
      }),
    );
  });

  it('de-duplicates media ids before attaching them', async () => {
    await submitDeliverable(COMMISSION_ID, ARTIST_ID, {
      type: 'FINAL',
      mediaIds: ['media-1', 'media-1'],
    });

    expect(txMock.media.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['media-1'] }, userId: ARTIST_ID },
      select: { id: true },
    });
  });

  it('rejects media that does not belong to the artist', async () => {
    txMock.media.findMany.mockResolvedValue([]);

    await expect(
      submitDeliverable(COMMISSION_ID, ARTIST_ID, {
        type: 'FINAL',
        mediaIds: ['someone-elses-media'],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(txMock.deliverable.create).not.toHaveBeenCalled();
  });

  it('rejects a submission from anyone but the assigned artist', async () => {
    await expect(
      submitDeliverable(COMMISSION_ID, CLIENT_ID, { type: 'FINAL' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(txMock.deliverable.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown commission', async () => {
    txMock.commission.findUnique.mockResolvedValue(null);

    await expect(
      submitDeliverable(COMMISSION_ID, ARTIST_ID, { type: 'FINAL' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each(['PENDING', 'DELIVERED', 'COMPLETED', 'CANCELLED'])(
    'rejects a submission while the commission is %s',
    async (status) => {
      txMock.commission.findUnique.mockResolvedValue(makeCommission(status));

      await expect(
        submitDeliverable(COMMISSION_ID, ARTIST_ID, { type: 'FINAL' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(txMock.deliverable.create).not.toHaveBeenCalled();
    },
  );

  it('rejects a note beyond the length limit', async () => {
    await expect(
      submitDeliverable(COMMISSION_ID, ARTIST_ID, { type: 'WIP', note: 'x'.repeat(2001) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(txMock.deliverable.create).not.toHaveBeenCalled();
  });

  it('rejects more than the media limit without querying', async () => {
    await expect(
      submitDeliverable(COMMISSION_ID, ARTIST_ID, {
        type: 'WIP',
        mediaIds: Array.from({ length: DELIVERABLE_MAX_MEDIA + 1 }, (_, i) => `media-${i}`),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(txMock.deliverable.create).not.toHaveBeenCalled();
  });
});

describe('reviewDeliverable (#823)', () => {
  beforeEach(() => {
    txMock.commission.findUnique.mockResolvedValue(makeCommission('DELIVERED'));
  });

  it('accepting the final deliverable completes the commission and releases escrow', async () => {
    const result = await reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, {
      decision: 'ACCEPT',
    });

    expect(txMock.deliverable.update).toHaveBeenCalledWith({
      where: { id: DELIVERABLE_ID },
      data: { status: 'ACCEPTED' },
    });
    expect(txMock.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'COMPLETED' },
    });
    expect(result).toMatchObject({
      commissionStatus: 'COMPLETED',
      escrowReleased: true,
      revisionCount: 0,
    });
    expect(txMock.commissionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: 'DELIVERED',
        toStatus: 'COMPLETED',
        actorId: CLIENT_ID,
      }),
    });
    expect(txMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: ARTIST_ID,
        type: 'COMMISSION_DELIVERABLE_ACCEPTED',
        data: expect.objectContaining({ escrowReleased: true }),
      }),
    });
  });

  it('refuses to accept a work-in-progress draft', async () => {
    txMock.deliverable.findUnique.mockResolvedValue(makeDeliverable('SUBMITTED', 'WIP'));

    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, { decision: 'ACCEPT' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(txMock.commission.update).not.toHaveBeenCalled();
  });

  it('refuses to accept when the commission is not DELIVERED', async () => {
    txMock.commission.findUnique.mockResolvedValue(makeCommission('IN_PROGRESS'));

    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, { decision: 'ACCEPT' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('requesting changes records a revision, reopens the work and notes the feedback', async () => {
    const result = await reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, {
      decision: 'REQUEST_CHANGES',
      note: '  Palette is off.  ',
    });

    expect(txMock.deliverable.update).toHaveBeenCalledWith({
      where: { id: DELIVERABLE_ID },
      data: { status: 'REJECTED' },
    });
    expect(txMock.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'IN_PROGRESS' },
    });
    expect(result).toMatchObject({
      commissionStatus: 'IN_PROGRESS',
      escrowReleased: false,
      revisionCount: 1,
      maxRevisions: 3,
    });
    expect(txMock.commissionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toStatus: 'IN_PROGRESS',
        note: 'Changes requested: Palette is off.',
      }),
    });
    expect(txMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: ARTIST_ID,
        type: 'COMMISSION_CHANGES_REQUESTED',
        data: expect.objectContaining({ note: 'Palette is off.', revisionCount: 1 }),
      }),
    });
  });

  it('counts the revision this request creates', async () => {
    txMock.deliverable.count.mockResolvedValue(2);

    const result = await reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, {
      decision: 'REQUEST_CHANGES',
      note: 'Still not right.',
    });

    expect(result.revisionCount).toBe(3);
  });

  it('requires feedback to request changes', async () => {
    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, {
        decision: 'REQUEST_CHANGES',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(txMock.deliverable.update).not.toHaveBeenCalled();
  });

  it('enforces the configured revision limit', async () => {
    txMock.deliverable.count.mockResolvedValue(3);

    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, {
        decision: 'REQUEST_CHANGES',
        note: 'One more please.',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(txMock.deliverable.update).not.toHaveBeenCalled();
  });

  it('only lets the client review', async () => {
    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, ARTIST_ID, { decision: 'ACCEPT' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(txMock.deliverable.update).not.toHaveBeenCalled();
  });

  it('rejects a deliverable that is not on this commission', async () => {
    txMock.deliverable.findUnique.mockResolvedValue({
      ...makeDeliverable(),
      commissionId: 'another-commission',
    });

    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, { decision: 'ACCEPT' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each([
    ['ACCEPTED', 'ACCEPT'],
    ['REJECTED', 'REQUEST_CHANGES'],
  ])('refuses to review a %s deliverable again', async (status, decision) => {
    txMock.deliverable.findUnique.mockResolvedValue(makeDeliverable(status));

    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, {
        decision: decision as 'ACCEPT' | 'REQUEST_CHANGES',
        note: 'again',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuses both decisions while a dispute holds escrow', async () => {
    txMock.commissionDispute.findFirst.mockResolvedValue({ id: 'dispute-1', status: 'OPEN' });

    await expect(
      reviewDeliverable(COMMISSION_ID, DELIVERABLE_ID, CLIENT_ID, { decision: 'ACCEPT' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'This commission has an open dispute; an admin must resolve it first',
    });
    expect(txMock.deliverable.update).not.toHaveBeenCalled();
  });
});
