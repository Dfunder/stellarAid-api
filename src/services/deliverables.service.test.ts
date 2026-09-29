import { beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT_ID = 'client-1';
const ARTIST_ID = 'artist-1';
const COMMISSION_ID = 'commission-1';

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    commission: { findUnique: vi.fn(), update: vi.fn() },
    deliverable: { create: vi.fn() },
    commissionEvent: { create: vi.fn() },
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

import { DELIVERABLE_MAX_MEDIA, submitDeliverable } from './deliverables.service';

function makeCommission(status = 'IN_PROGRESS') {
  return {
    id: COMMISSION_ID,
    clientId: CLIENT_ID,
    artistId: ARTIST_ID,
    status,
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
