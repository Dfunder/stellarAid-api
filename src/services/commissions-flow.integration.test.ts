/**
 * End-to-end commission flow tests (#829).
 *
 * These chain the real service functions the way a request flow would:
 * request -> accept -> deliver -> review -> complete, decline, a
 * request-changes round trip, and dispute/escrow handling. Prisma is backed
 * by a small in-memory fake (no real DB or HTTP layer — see
 * marketplace-flow.integration.test.ts for the same convention) so the
 * service-layer contracts are exercised end to end, including the audit
 * trail, rather than each function in isolation.
 *
 * Escrow note: this API has no on-chain escrow binding — the Stellar escrow
 * lives in the contracts repo. What the API *does* own is the hold: while a
 * dispute is OPEN/REVIEWING the commission cannot be COMPLETED (release) or
 * CANCELLED (refund), and only an admin decision moves it. Those invariants
 * are what the escrow tests below lock down.
 *
 * Deliverables note: there is no deliverable upload/submit endpoint yet
 * (deliverables are read-only here), so the "request changes" leg is modelled
 * with the flow that does exist: the client disputes the delivery and an admin
 * rejects the dispute, which returns the commission to DELIVERED. From there
 * the client accepts the revised work — the status machine has no
 * DELIVERED -> DELIVERED transition, so the artist does not re-submit.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommissionStatus, CommissionDisputeStatus, Role } from '@prisma/client';

const CLIENT_ID = 'client-1';
const ARTIST_ID = 'artist-1';
const ADMIN_ID = 'admin-1';
const COMMISSION_ID = 'commission-1';

interface FakeCommission {
  id: string;
  clientId: string;
  artistId: string;
  title: string;
  description: string | null;
  budget: number;
  asset: 'USDC' | 'XLM';
  deadline: Date;
  status: CommissionStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeDispute {
  id: string;
  commissionId: string;
  raisedById: string;
  reason: string;
  evidence: unknown;
  status: CommissionDisputeStatus;
  resolution: string | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeEvent {
  id: string;
  commissionId: string;
  fromStatus: CommissionStatus | null;
  toStatus: CommissionStatus;
  actorId: string;
  note: string | null;
  createdAt: Date;
}

interface FakeNotification {
  userId: string;
  type: string;
  data: unknown;
}

/** Everything the fake database holds for one flow. */
interface FlowState {
  commission: FakeCommission;
  disputes: FakeDispute[];
  events: FakeEvent[];
  notifications: FakeNotification[];
  reviews: Array<Record<string, unknown>>;
}

let commission: FakeCommission;
let disputes: FakeDispute[];
let events: FakeEvent[];
let notifications: FakeNotification[];
let reviews: Array<Record<string, unknown>>;

function resetState(): void {
  commission = {
    id: COMMISSION_ID,
    clientId: CLIENT_ID,
    artistId: ARTIST_ID,
    title: 'Album cover',
    description: 'A painted cover for an upcoming album.',
    budget: 250,
    asset: 'USDC',
    deadline: new Date('2027-01-01T00:00:00Z'),
    status: 'PENDING',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-01T10:00:00Z'),
  };
  disputes = [];
  events = [];
  notifications = [];
  reviews = [];
}

const { prismaMock } = vi.hoisted(() => {
  // Shared, mutable flow state. `vi.hoisted` runs before imports, so the
  // fakes are rebuilt in `beforeEach` (see `resetState`) and handed to the
  // mock through `setState`.
  let state: FlowState;

  const isOpen = (d: FakeDispute) => d.status === 'OPEN' || d.status === 'REVIEWING';

  const tx = {
    commission: {
      findUnique: vi.fn(async () => (state ? { ...state.commission } : null)),
      create: vi.fn(async ({ data }: { data: Partial<FakeCommission> }) => {
        state.commission = {
          ...state.commission,
          ...data,
          status: 'PENDING',
        } as FakeCommission;
        return { ...state.commission };
      }),
      update: vi.fn(async ({ data }: { data: Partial<FakeCommission> }) => {
        state.commission = { ...state.commission, ...data, updatedAt: new Date() };
        return { ...state.commission };
      }),
    },
    review: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const review = { id: `review-${state.reviews.length + 1}`, ...data };
        state.reviews.push(review);
        return review;
      }),
    },
    commissionEvent: {
      create: vi.fn(async ({ data }: { data: Omit<FakeEvent, 'id' | 'createdAt'> }) => {
        const event = { id: `event-${state.events.length + 1}`, ...data, createdAt: new Date() };
        state.events.push(event);
        return event;
      }),
    },
    commissionDispute: {
      findUnique: vi.fn(async () => {
        const dispute = state.disputes.find((d) => d.commissionId === state.commission.id);
        return dispute ? { ...dispute } : null;
      }),
      findFirst: vi.fn(async () => {
        const dispute = state.disputes.find(isOpen);
        return dispute ? { ...dispute } : null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const dispute: FakeDispute = {
          id: `dispute-${state.disputes.length + 1}`,
          commissionId: String(data.commissionId),
          raisedById: String(data.raisedById),
          reason: String(data.reason),
          evidence: data.evidence ?? null,
          status: 'OPEN',
          resolution: null,
          resolvedById: null,
          resolvedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.disputes.push(dispute);
        return { ...dispute };
      }),
      update: vi.fn(async ({ data }: { data: Partial<FakeDispute> }) => {
        const dispute = state.disputes.find((d) => d.commissionId === state.commission.id)!;
        Object.assign(dispute, data, { updatedAt: new Date() });
        return { ...dispute };
      }),
    },
    user: {
      findMany: vi.fn(async () => [{ id: 'admin-1' }]),
    },
    notification: {
      create: vi.fn(async ({ data }: { data: FakeNotification }) => {
        state.notifications.push(data);
        return { id: `notification-${state.notifications.length}` };
      }),
      createMany: vi.fn(async ({ data }: { data: FakeNotification[] }) => {
        state.notifications.push(...data);
        return { count: data.length };
      }),
    },
  };

  const prisma = {
    // The callback is typed loosely to avoid a self-referential annotation on
    // `tx` while it is still being defined.
    $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => callback(tx)),
    tx,
    // Read side used by `getCommissionDetail`.
    commission: { findUnique: vi.fn() },
    commissionEvent: { findMany: vi.fn() },
    deliverable: { findMany: vi.fn() },
    review: { findMany: vi.fn() },
    commissionDispute: { findUnique: vi.fn() },
    // Write side used by `createCommission` (outside its transaction).
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    setState: (next: FlowState) => {
      state = next;
    },
    getState: () => state,
  };

  return { prismaMock: prisma };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));
vi.mock('@/services/cache.service', () => ({ invalidateNamespace: vi.fn() }));

import {
  createCommission,
  getCommissionDetail,
  raiseCommissionDispute,
  resolveCommissionDispute,
  updateCommissionStatus,
} from './commissions.service';

const CREATE_INPUT = {
  artistId: ARTIST_ID,
  title: 'Album cover',
  description: 'A painted cover for an upcoming album.',
  budget: 250,
  asset: 'USDC' as const,
  deadline: new Date('2027-01-01T00:00:00Z'),
};

/** Wire the read-side mocks to the current in-memory flow state. */
function syncReads(): void {
  const state = prismaMock.getState();
  prismaMock.commission.findUnique.mockImplementation(async () => ({ ...state.commission }));
  prismaMock.commissionEvent.findMany.mockImplementation(async () =>
    [...state.events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  );
  prismaMock.review.findMany.mockImplementation(async () => [...state.reviews]);
  prismaMock.commissionDispute.findUnique.mockImplementation(async () => {
    const dispute = state.disputes.find((d) => d.commissionId === state.commission.id);
    return dispute ? { ...dispute } : null;
  });
  prismaMock.deliverable.findMany.mockResolvedValue([]);
  prismaMock.user.findMany.mockResolvedValue([
    { id: CLIENT_ID, name: 'Client', username: 'client', role: 'USER' },
    { id: ARTIST_ID, name: 'Artist', username: 'artist', role: 'ARTIST' },
  ]);
  prismaMock.user.findUnique.mockResolvedValue({ id: ARTIST_ID, role: 'ARTIST' });
}

/** The status transitions a full delivery takes, in order. */
async function deliverWork(): Promise<void> {
  await updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST' as Role, {
    status: 'ACCEPTED',
  });
  await updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST' as Role, {
    status: 'IN_PROGRESS',
  });
  await updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST' as Role, {
    status: 'DELIVERED',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetState();
  // `resetState` rebuilds the module-level state; hand it to the hoisted mock.
  prismaMock.setState({ commission, disputes, events, notifications, reviews });
  syncReads();
});

describe('commission flow: request -> accept -> deliver -> review -> complete (#829)', () => {
  it('walks the whole lifecycle and records it in the timeline', async () => {
    const created = await createCommission(CLIENT_ID, CREATE_INPUT);
    expect(created.status).toBe('PENDING');
    // The artist is told about the request.
    expect(prismaMock.getState().notifications).toEqual([
      expect.objectContaining({ userId: ARTIST_ID, type: 'COMMISSION_REQUEST' }),
    ]);

    await deliverWork();
    expect(prismaMock.getState().commission.status).toBe('DELIVERED');

    const completed = await updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER' as Role, {
      status: 'COMPLETED',
      review: { rating: 5, title: 'Beautiful work', body: 'Exactly what I wanted.' },
    });
    expect(completed.status).toBe('COMPLETED');

    // Completing writes the review against the artist, on the client's behalf.
    expect(prismaMock.getState().reviews).toEqual([
      expect.objectContaining({
        commissionId: COMMISSION_ID,
        authorId: CLIENT_ID,
        targetId: ARTIST_ID,
        rating: 5,
      }),
    ]);

    const detail = await getCommissionDetail(COMMISSION_ID, CLIENT_ID, 'USER' as Role);
    expect(detail.commission.status).toBe('COMPLETED');
    expect(detail.reviews).toHaveLength(1);
    expect(detail.timeline.map((entry) => entry.toStatus)).toEqual([
      'PENDING',
      'ACCEPTED',
      'IN_PROGRESS',
      'DELIVERED',
      'COMPLETED',
    ]);
    expect(detail.timeline[0]).toMatchObject({ type: 'CREATED', actorId: CLIENT_ID });
    // Oldest first, and the audit trail is complete.
    expect(detail.timeline.every((entry, i, all) => i === 0 || entry.at >= all[i - 1]!.at)).toBe(
      true,
    );
  });

  it('refuses to complete without the mandatory review', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();

    await expect(
      updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER' as Role, { status: 'COMPLETED' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.getState().commission.status).toBe('DELIVERED');
  });

  it('keeps non-participants out of the transition surface', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);

    await expect(
      updateCommissionStatus(COMMISSION_ID, 'stranger', 'USER' as Role, { status: 'ACCEPTED' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      getCommissionDetail(COMMISSION_ID, 'stranger', 'USER' as Role),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a transition the actor is not allowed to make', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);

    // The client cannot accept work on the artist's behalf.
    await expect(
      updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER' as Role, {
        status: 'ACCEPTED',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Cannot change commission from PENDING to ACCEPTED',
    });
  });

  it('rejects an out-of-order jump across the status machine', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);

    await expect(
      updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST' as Role, {
        status: 'DELIVERED',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.getState().commission.status).toBe('PENDING');
  });
});

describe('commission flow: request -> decline (#829)', () => {
  it('lets the artist decline a pending request', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);

    const declined = await updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST' as Role, {
      status: 'CANCELLED',
    });

    expect(declined.status).toBe('CANCELLED');
    expect(prismaMock.getState().events).toEqual([
      expect.objectContaining({
        fromStatus: 'PENDING',
        toStatus: 'CANCELLED',
        actorId: ARTIST_ID,
      }),
    ]);
  });

  it('also lets the client withdraw a pending request', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);

    const withdrawn = await updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER' as Role, {
      status: 'CANCELLED',
    });
    expect(withdrawn.status).toBe('CANCELLED');
  });

  it('cannot decline once the work has been delivered', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();

    await expect(
      updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST' as Role, {
        status: 'CANCELLED',
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'This commission can no longer be cancelled',
    });
  });
});

describe('commission flow: deliver -> request changes -> deliver -> accept (#829)', () => {
  it('returns rejected work to the artist and still completes afterwards', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();

    // "Request changes": the client disputes the delivery...
    const dispute = await raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, {
      reason: 'The colour palette is off, please revise.',
    });
    expect(dispute.status).toBe('OPEN');
    expect(prismaMock.getState().commission.status).toBe('DISPUTED');

    // ...and the admin sends it back to the artist instead of refunding.
    const { commission: revised, dispute: resolved } = await resolveCommissionDispute(
      COMMISSION_ID,
      ADMIN_ID,
      'ADMIN' as Role,
      { decision: 'REJECT', resolution: 'Artist to revise and redeliver.' },
    );
    expect(revised.status).toBe('DELIVERED');
    expect(resolved.status).toBe('REJECTED');

    // Back in DELIVERED, the client accepts the revised work.
    const completed = await updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER' as Role, {
      status: 'COMPLETED',
      review: { rating: 4, body: 'Much better after the revision.' },
    });
    expect(completed.status).toBe('COMPLETED');

    const detail = await getCommissionDetail(COMMISSION_ID, ARTIST_ID, 'ARTIST' as Role);
    expect(detail.timeline.map((entry) => entry.toStatus)).toEqual([
      'PENDING',
      'ACCEPTED',
      'IN_PROGRESS',
      'DELIVERED', // first delivery
      'DISPUTED', // changes requested
      'DELIVERED', // dispute rejected -> back to the artist
      'COMPLETED', // accepted after the revision
    ]);
  });

  it('refuses to dispute again while the first dispute is still open', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();
    await raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, { reason: 'Needs revision.' });

    // The commission is DISPUTED, so it is no longer "on final delivery".
    await expect(
      raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, { reason: 'Still wrong.' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'A commission can only be disputed on final delivery',
    });
  });

  it('refuses a fresh dispute after an earlier one was rejected', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();
    await raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, { reason: 'Needs revision.' });
    await resolveCommissionDispute(COMMISSION_ID, ADMIN_ID, 'ADMIN' as Role, {
      decision: 'REJECT',
    });

    // DELIVERED again, but only one dispute record can ever exist per
    // commission (`CommissionDispute.commissionId` is unique).
    await expect(
      raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, { reason: 'Still wrong.' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'This commission already has a dispute',
    });
  });

  it('only lets the client dispute, and only after delivery', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);

    // Not delivered yet.
    await expect(
      raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, { reason: 'Too slow.' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await deliverWork();

    // The artist cannot dispute their own delivery.
    await expect(
      raiseCommissionDispute(COMMISSION_ID, ARTIST_ID, { reason: 'Nope.' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('commission flow: escrow is held while a dispute is open (#829)', () => {
  it('blocks releasing the funds to the artist while the dispute is open', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();
    await raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, { reason: 'Wrong files.' });

    // `DISPUTED` has no edge to `COMPLETED`, so the status machine refuses the
    // release first; the explicit escrow guard in `updateCommissionStatus` is
    // the second line of defence behind it.
    await expect(
      updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER' as Role, {
        status: 'COMPLETED',
        review: { rating: 1, body: 'Not what I paid for.' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(prismaMock.getState().reviews).toHaveLength(0);
    expect(prismaMock.getState().commission.status).toBe('DISPUTED');
  });

  it('blocks refunding the client while the dispute is open', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();
    await raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, { reason: 'Wrong files.' });

    await expect(
      updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER' as Role, { status: 'CANCELLED' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.getState().commission.status).toBe('DISPUTED');
  });

  it('releases to the artist and notifies both parties', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();
    await raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, { reason: 'Wrong files.' });

    const { commission: settled, dispute } = await resolveCommissionDispute(
      COMMISSION_ID,
      ADMIN_ID,
      'ADMIN' as Role,
      { decision: 'RELEASE_TO_ARTIST', resolution: 'Evidence shows delivery was made.' },
    );

    expect(settled.status).toBe('COMPLETED');
    expect(dispute).toMatchObject({
      status: 'RESOLVED',
      resolvedById: ADMIN_ID,
    });
    expect(dispute.resolvedAt).toBeInstanceOf(Date);
    expect(prismaMock.getState().notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: CLIENT_ID, type: 'COMMISSION_DISPUTE_RESOLVED' }),
        expect.objectContaining({ userId: ARTIST_ID, type: 'COMMISSION_DISPUTE_RESOLVED' }),
      ]),
    );
  });

  it('refunds the client by cancelling the commission', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();
    await raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, { reason: 'Never delivered.' });

    const { commission: settled, dispute } = await resolveCommissionDispute(
      COMMISSION_ID,
      ADMIN_ID,
      'ADMIN' as Role,
      { decision: 'REFUND_CLIENT' },
    );

    expect(settled.status).toBe('CANCELLED');
    expect(dispute.status).toBe('RESOLVED');
  });

  it('only an admin may resolve a dispute, and only once', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();
    await raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, { reason: 'Wrong files.' });

    await expect(
      resolveCommissionDispute(COMMISSION_ID, CLIENT_ID, 'USER' as Role, {
        decision: 'RELEASE_TO_ARTIST',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await resolveCommissionDispute(COMMISSION_ID, ADMIN_ID, 'ADMIN' as Role, {
      decision: 'REJECT',
    });

    await expect(
      resolveCommissionDispute(COMMISSION_ID, ADMIN_ID, 'ADMIN' as Role, {
        decision: 'RELEASE_TO_ARTIST',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('reports a missing dispute on a delivered commission', async () => {
    await createCommission(CLIENT_ID, CREATE_INPUT);
    await deliverWork();

    await expect(
      resolveCommissionDispute(COMMISSION_ID, ADMIN_ID, 'ADMIN' as Role, {
        decision: 'REJECT',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'This commission has no dispute to resolve',
    });
  });
});

describe('commission request validation (#829)', () => {
  it('rejects a self-commission', async () => {
    await expect(
      createCommission(CLIENT_ID, { ...CREATE_INPUT, artistId: CLIENT_ID }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a recipient who is not an artist', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: ARTIST_ID, role: 'USER' });
    await expect(createCommission(CLIENT_ID, CREATE_INPUT)).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
    });
  });

  it('rejects an unknown recipient', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(createCommission(CLIENT_ID, CREATE_INPUT)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
