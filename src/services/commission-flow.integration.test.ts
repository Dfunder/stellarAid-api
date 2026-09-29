/**
 * End-to-end commission lifecycle + escrow tests (#829).
 *
 * The API's only commission-writing entry point is `updateCommissionStatus`,
 * so that is what these tests drive — request → accept → deliver → review →
 * complete, declines, revision loops and disputes — against a small stateful
 * fake of the two tables it writes (`Commission`, `Review`). Each step is
 * therefore validated against the status the previous step left behind,
 * rather than against hand-written per-test stubs.
 *
 * The Soroban `commission_agreement`/`escrow` contract never talks to this
 * process directly, so the fake mirrors the contract's money legs
 * (fund → hold → release / refund / freeze) and derives them from the status
 * a `Commission` update observed. That keeps the status → escrow mapping
 * pinned down: a transition with no escrow meaning throws instead of silently
 * passing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT_ID = 'client-1';
const ARTIST_ID = 'artist-1';
const COMMISSION_ID = 'commission-1';
const OUTSIDER_ID = 'outsider-1';

type Status =
  'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

type EscrowState = 'UNFUNDED' | 'HELD' | 'RELEASED' | 'REFUNDED' | 'FROZEN';

interface CommissionRow {
  id: string;
  clientId: string;
  artistId: string;
  title: string;
  budget: number;
  asset: string;
  status: Status;
}

interface ReviewRow {
  commissionId: string;
  authorId: string;
  targetId: string;
  rating: number;
  title?: string;
  body: string;
}

const { prismaMock, db, escrowByStatus } = vi.hoisted(() => {
  /**
   * Money legs of the escrow contract, keyed by the commission status the API
   * moved to. Funds are committed when the artist accepts, held through
   * delivery and revisions, released on completion, refunded if either party
   * cancels before delivery, and frozen once a delivery is disputed.
   */
  const escrowByStatus: Record<string, string> = {
    PENDING: 'UNFUNDED',
    ACCEPTED: 'HELD',
    IN_PROGRESS: 'HELD',
    DELIVERED: 'HELD',
    COMPLETED: 'RELEASED',
    CANCELLED: 'REFUNDED',
    DISPUTED: 'FROZEN',
  };

  const state = {
    commission: null as CommissionRow | null,
    reviews: [] as ReviewRow[],
    escrow: 'UNFUNDED',
  };

  /** Applies the escrow leg for a status change, mirroring the contract. */
  const applyEscrow = (status: string): void => {
    const next = escrowByStatus[status];
    if (next === undefined) {
      throw new Error(`No escrow leg defined for status ${status}`);
    }
    state.escrow = next;
  };

  const transaction = {
    commission: {
      findUnique: vi.fn(async () => (state.commission === null ? null : { ...state.commission })),
      update: vi.fn(async ({ data }: { data: { status: Status } }) => {
        if (state.commission === null) {
          throw new Error('commission row missing');
        }
        state.commission = { ...state.commission, status: data.status };
        applyEscrow(data.status);
        return { ...state.commission };
      }),
    },
    review: {
      create: vi.fn(async ({ data }: { data: ReviewRow }) => {
        // Mirrors the `@@unique([commissionId])` constraint on Review.
        if (state.reviews.some((review) => review.commissionId === data.commissionId)) {
          throw { code: 'P2002' };
        }
        state.reviews.push(data);
        return { id: `review-${state.reviews.length}`, ...data };
      }),
    },
  };

  return {
    prismaMock: {
      $transaction: vi.fn((callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    },
    db: state,
    escrowByStatus,
  };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import { updateCommissionStatus } from './commissions.service';
import { commissionStatusBodySchema } from '@/validators';

function seedCommission(status: Status): void {
  db.commission = {
    id: COMMISSION_ID,
    clientId: CLIENT_ID,
    artistId: ARTIST_ID,
    title: 'Album cover illustration',
    budget: 250,
    asset: 'USDC',
    status,
  };
  db.reviews = [];
  // Escrow state as the contract would have left it for this status.
  db.escrow = escrowByStatus[status] as EscrowState;
}

/** Drives one transition the way the HTTP layer would. */
function move(
  status: Status,
  actor: { id: string; role?: 'ARTIST' | 'USER' },
  review?: { rating: number; title?: string; body: string },
) {
  return updateCommissionStatus(COMMISSION_ID, actor.id, actor.role ?? 'USER', {
    status,
    review,
  });
}

const artist = { id: ARTIST_ID, role: 'ARTIST' as const };
const client = { id: CLIENT_ID, role: 'USER' as const };
const REVIEW = { rating: 5, title: 'Excellent work', body: 'Delivered ahead of the deadline.' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('commission lifecycle: request → accept → deliver → review → complete (#829)', () => {
  it('walks the happy path and releases the escrow on completion', async () => {
    seedCommission('PENDING');

    await expect(move('ACCEPTED', artist)).resolves.toMatchObject({ status: 'ACCEPTED' });
    expect(db.escrow).toBe('HELD');

    await expect(move('IN_PROGRESS', artist)).resolves.toMatchObject({ status: 'IN_PROGRESS' });
    expect(db.escrow).toBe('HELD');

    await expect(move('DELIVERED', artist)).resolves.toMatchObject({ status: 'DELIVERED' });
    expect(db.escrow).toBe('HELD');

    const completed = await move('COMPLETED', client, REVIEW);
    expect(completed).toMatchObject({ status: 'COMPLETED' });
    // Completion is what releases the held budget to the artist.
    expect(db.escrow).toBe('RELEASED');

    // The client's review is stored against the artist, not the client.
    expect(db.reviews).toHaveLength(1);
    expect(db.reviews[0]).toMatchObject({
      commissionId: COMMISSION_ID,
      authorId: CLIENT_ID,
      targetId: ARTIST_ID,
      rating: 5,
      body: REVIEW.body,
    });
  });

  it('treats COMPLETED as terminal — the escrow cannot be moved again', async () => {
    seedCommission('DELIVERED');

    await move('COMPLETED', client, REVIEW);

    await expect(move('CANCELLED', client)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(move('DISPUTED', client)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.escrow).toBe('RELEASED');
    expect(db.reviews).toHaveLength(1);
  });
});

describe('commission decline and cancellation (#829)', () => {
  it('lets the artist decline a pending request, refunding the escrow', async () => {
    seedCommission('PENDING');

    await expect(move('CANCELLED', artist)).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(db.escrow).toBe('REFUNDED');

    // A declined request cannot be picked back up.
    await expect(move('ACCEPTED', artist)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.reviews).toHaveLength(0);
  });

  it('lets the client cancel an in-progress commission, refunding the escrow', async () => {
    seedCommission('IN_PROGRESS');

    await expect(move('CANCELLED', client)).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(db.escrow).toBe('REFUNDED');
  });

  it('refuses to cancel once the work has been delivered', async () => {
    seedCommission('DELIVERED');

    await expect(move('CANCELLED', client)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.escrow).toBe('HELD');
  });

  it('refuses to cancel twice', async () => {
    seedCommission('PENDING');

    await move('CANCELLED', client);

    await expect(move('CANCELLED', client)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.escrow).toBe('REFUNDED');
  });
});

describe('commission revision loop: deliver → request changes → deliver → accept (#829)', () => {
  it('keeps the escrow held across revisions and releases only on completion', async () => {
    seedCommission('PENDING');

    await move('ACCEPTED', artist);
    await move('IN_PROGRESS', artist);
    await move('DELIVERED', artist);

    // Client asks for changes: back to IN_PROGRESS, money still in escrow.
    await expect(move('IN_PROGRESS', client)).resolves.toMatchObject({ status: 'IN_PROGRESS' });
    expect(db.escrow).toBe('HELD');

    await move('DELIVERED', artist);
    expect(db.escrow).toBe('HELD');

    await move('COMPLETED', client, REVIEW);
    expect(db.escrow).toBe('RELEASED');
    expect(db.reviews).toHaveLength(1);
  });

  it('supports more than one revision round', async () => {
    seedCommission('DELIVERED');

    await move('IN_PROGRESS', client);
    await move('DELIVERED', artist);
    await move('IN_PROGRESS', client);
    await move('DELIVERED', artist);
    await move('COMPLETED', client, REVIEW);

    expect(db.escrow).toBe('RELEASED');
  });
});

describe('commission dispute (#829)', () => {
  it('freezes the escrow and blocks completion', async () => {
    seedCommission('DELIVERED');

    await expect(move('DISPUTED', client)).resolves.toMatchObject({ status: 'DISPUTED' });
    expect(db.escrow).toBe('FROZEN');

    await expect(move('COMPLETED', client, REVIEW)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.escrow).toBe('FROZEN');
    expect(db.reviews).toHaveLength(0);
  });
});

describe('commission lifecycle edge cases (#829)', () => {
  it('rejects a user who is neither client nor artist', async () => {
    seedCommission('PENDING');

    await expect(move('ACCEPTED', { id: OUTSIDER_ID, role: 'ARTIST' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(db.escrow).toBe('UNFUNDED');
  });

  it('404s for a commission that does not exist', async () => {
    db.commission = null;

    await expect(move('ACCEPTED', artist)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses the client an artist-only step', async () => {
    seedCommission('PENDING');

    await expect(move('IN_PROGRESS', client)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuses the artist the client-only acceptance step', async () => {
    seedCommission('DELIVERED');

    await expect(move('COMPLETED', artist, REVIEW)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.escrow).toBe('HELD');
  });

  it('requires a review when completing', async () => {
    seedCommission('DELIVERED');

    await expect(move('COMPLETED', client)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.escrow).toBe('HELD');
    expect(db.reviews).toHaveLength(0);
  });

  it('rejects a review sent alongside a non-completing step', async () => {
    seedCommission('ACCEPTED');

    await expect(
      move('IN_PROGRESS', artist, { rating: 5, body: 'premature' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.reviews).toHaveLength(0);
  });

  it('rejects an out-of-range completion rating at the request boundary', () => {
    // The endpoint validates the body with `commissionStatusBodySchema` before
    // the service is reached, so a 9-star review never opens the escrow.
    const parsed = commissionStatusBodySchema.safeParse({
      status: 'COMPLETED',
      review: { rating: 9, body: 'out of range' },
    });

    expect(parsed.success).toBe(false);
  });
});
