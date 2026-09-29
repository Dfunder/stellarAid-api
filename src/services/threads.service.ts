/**
 * Message thread creation (#837).
 * One thread per unordered pair of users; returns existing if present.
 */

import { AppError } from '@/middlewares';
import { prisma } from '@/services/prisma.service';

export interface CreateThreadInput {
  /** The other participant (caller is always included). */
  participantId: string;
}

export interface ThreadParticipantView {
  userId: string;
  name: string;
  username: string;
}

export interface ThreadView {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  participants: ThreadParticipantView[];
}

/**
 * Find an existing 1:1 thread between two users, if any.
 */
export async function findThreadBetween(userA: string, userB: string): Promise<ThreadView | null> {
  const rows = await prisma.threadParticipant.findMany({
    where: { userId: { in: [userA, userB] } },
    select: { threadId: true, userId: true },
  });

  const byThread = new Map<string, Set<string>>();
  for (const r of rows) {
    let set = byThread.get(r.threadId);
    if (!set) {
      set = new Set();
      byThread.set(r.threadId, set);
    }
    set.add(r.userId);
  }

  for (const [threadId, users] of byThread) {
    if (users.has(userA) && users.has(userB) && users.size === 2) {
      return loadThreadView(threadId);
    }
  }
  return null;
}

async function loadThreadView(threadId: string): Promise<ThreadView> {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: { participants: true },
  });
  if (thread === null) {
    throw new AppError('NOT_FOUND', 'Thread not found');
  }
  const userIds = thread.participants.map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, username: true },
  });
  const map = new Map(users.map((u) => [u.id, u]));
  return {
    id: thread.id,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    participants: userIds.map((id) => {
      const u = map.get(id);
      return {
        userId: id,
        name: u?.name ?? 'Unknown',
        username: u?.username ?? 'unknown',
      };
    }),
  };
}

/**
 * Create a thread between the authenticated user and participantId.
 * Returns the existing thread if the pair already has one (#837).
 */
export async function createOrGetThread(
  currentUserId: string,
  input: CreateThreadInput,
): Promise<{ thread: ThreadView; created: boolean }> {
  const otherId = input.participantId?.trim();
  if (!otherId) {
    throw new AppError('BAD_REQUEST', 'participantId is required');
  }
  if (otherId === currentUserId) {
    throw new AppError('BAD_REQUEST', 'Cannot create a thread with yourself');
  }

  const other = await prisma.user.findUnique({ where: { id: otherId }, select: { id: true } });
  if (other === null) {
    throw new AppError('NOT_FOUND', 'Participant not found');
  }

  const existing = await findThreadBetween(currentUserId, otherId);
  if (existing) {
    return { thread: existing, created: false };
  }

  const thread = await prisma.messageThread.create({
    data: {
      participants: {
        create: [{ userId: currentUserId }, { userId: otherId }],
      },
    },
  });

  const view = await loadThreadView(thread.id);
  return { thread: view, created: true };
}
