import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, transactionMock } = vi.hoisted(() => {
  const transaction = {
    commission: { create: vi.fn() },
    notification: { create: vi.fn() },
  };
  const prisma = {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };
  return { prismaMock: prisma, transactionMock: transaction };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import { createCommission } from './commissions.service';

const CLIENT_ID = 'client-id';
const ARTIST_ID = 'artist-id';
const input = {
  artistId: ARTIST_ID,
  title: 'Album cover',
  description: 'A painted cover for an upcoming album.',
  budget: 250,
  asset: 'USDC' as const,
  deadline: new Date('2027-01-01'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCommission', () => {
  it('rejects self-commissions with 400', async () => {
    await expect(
      createCommission(CLIENT_ID, { ...input, artistId: CLIENT_ID }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('creates a pending commission and notifies the artist atomically', async () => {
    const commission = { id: 'commission-id', ...input, clientId: CLIENT_ID, status: 'PENDING' };
    prismaMock.user.findUnique.mockResolvedValue({ id: ARTIST_ID, role: 'ARTIST' });
    transactionMock.commission.create.mockResolvedValue(commission);

    await expect(createCommission(CLIENT_ID, input)).resolves.toEqual(commission);

    expect(transactionMock.commission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: CLIENT_ID,
        artistId: ARTIST_ID,
        status: 'PENDING',
        asset: 'USDC',
      }),
    });
    expect(transactionMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: ARTIST_ID,
        type: 'COMMISSION_REQUEST',
        data: { commissionId: 'commission-id', clientId: CLIENT_ID, title: input.title },
      },
    });
  });
});
