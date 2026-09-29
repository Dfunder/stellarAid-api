import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    threadParticipant: { findMany: vi.fn() },
    messageThread: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  return { prismaMock: prisma };
});

vi.mock('@/services/prisma.service', () => ({ prisma: prismaMock }));

import { createOrGetThread } from './threads.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createOrGetThread (#837)', () => {
  it('rejects self-threads', async () => {
    await expect(createOrGetThread('u1', { participantId: 'u1' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('returns existing thread for the same pair', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u2' });
    prismaMock.threadParticipant.findMany.mockResolvedValue([
      { threadId: 't1', userId: 'u1' },
      { threadId: 't1', userId: 'u2' },
    ]);
    prismaMock.messageThread.findUnique.mockResolvedValue({
      id: 't1',
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [{ userId: 'u1' }, { userId: 'u2' }],
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'A', username: 'a' },
      { id: 'u2', name: 'B', username: 'b' },
    ]);

    const result = await createOrGetThread('u1', { participantId: 'u2' });
    expect(result.created).toBe(false);
    expect(result.thread.id).toBe('t1');
    expect(result.thread.participants).toHaveLength(2);
    expect(prismaMock.messageThread.create).not.toHaveBeenCalled();
  });

  it('creates a new thread when none exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u2' });
    prismaMock.threadParticipant.findMany.mockResolvedValue([]);
    prismaMock.messageThread.create.mockResolvedValue({ id: 't-new' });
    prismaMock.messageThread.findUnique.mockResolvedValue({
      id: 't-new',
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [{ userId: 'u1' }, { userId: 'u2' }],
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'A', username: 'a' },
      { id: 'u2', name: 'B', username: 'b' },
    ]);

    const result = await createOrGetThread('u1', { participantId: 'u2' });
    expect(result.created).toBe(true);
    expect(result.thread.id).toBe('t-new');
  });
});
