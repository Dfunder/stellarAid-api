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
export async function findThreadBetween(
  userA: string,
  userB: string,
): Promise<ThreadView | null> {
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

export const MESSAGE_MAX_LENGTH = 5000;

export interface ThreadListItem {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    createdAt: Date;
  } | null;
  unreadCount: number;
  participants: ThreadParticipantView[];
}

async function assertParticipant(threadId: string, userId: string): Promise<void> {
  const row = await prisma.threadParticipant.findUnique({
    where: { threadId_userId: { threadId, userId } },
  });
  if (row === null) {
    throw new AppError('FORBIDDEN', 'You are not a participant in this thread');
  }
}

/**
 * Send a message in a thread (#838).
 */
export async function sendMessage(
  threadId: string,
  senderId: string,
  body: string,
) {
  const trimmed = body?.trim() ?? '';
  if (trimmed.length === 0) {
    throw new AppError('BAD_REQUEST', 'Message body cannot be empty');
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    throw new AppError(
      'BAD_REQUEST',
      `Message body must be at most ${MESSAGE_MAX_LENGTH} characters`,
    );
  }

  await assertParticipant(threadId, senderId);

  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: { participants: true },
  });
  if (thread === null) {
    throw new AppError('NOT_FOUND', 'Thread not found');
  }

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: { threadId, senderId, body: trimmed },
    });
    await tx.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });
    return msg;
  });

  const others = thread.participants
    .map((p) => p.userId)
    .filter((id) => id !== senderId);

  if (others.length > 0) {
    await prisma.notification.createMany({
      data: others.map((userId) => ({
        userId,
        type: 'NEW_MESSAGE',
        data: {
          threadId,
          messageId: message.id,
          senderId,
          preview: trimmed.slice(0, 120),
        },
      })),
    });
  }

  return message;
}

/**
 * List current user's threads with last message preview and unread counts (#839).
 */
export async function listUserThreads(userId: string): Promise<ThreadListItem[]> {
  const memberships = await prisma.threadParticipant.findMany({
    where: { userId },
    include: {
      thread: {
        include: {
          participants: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  const items: ThreadListItem[] = [];
  for (const m of memberships) {
    const thread = m.thread;
    const last = thread.messages[0] ?? null;
    const unreadCount = await prisma.message.count({
      where: {
        threadId: thread.id,
        senderId: { not: userId },
        readAt: null,
      },
    });
    const view = await loadThreadView(thread.id);
    items.push({
      id: thread.id,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      lastMessage: last
        ? {
            id: last.id,
            body: last.body.slice(0, 200),
            senderId: last.senderId,
            createdAt: last.createdAt,
          }
        : null,
      unreadCount,
      participants: view.participants,
    });
  }

  items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return items;
}

/**
 * Paginated messages oldest-first; marks others' messages as read (#839).
 */
export async function listThreadMessages(
  threadId: string,
  userId: string,
  options?: { limit?: number; cursor?: string },
) {
  await assertParticipant(threadId, userId);
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);

  const messages = await prisma.message.findMany({
    where: {
      threadId,
      ...(options?.cursor ? { createdAt: { gt: new Date(options.cursor) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit + 1,
  });

  const page = messages.slice(0, limit);
  const nextCursor =
    messages.length > limit ? page[page.length - 1]!.createdAt.toISOString() : null;

  if (page.length > 0) {
    await prisma.message.updateMany({
      where: {
        threadId,
        senderId: { not: userId },
        readAt: null,
        id: { in: page.map((m) => m.id) },
      },
      data: { readAt: new Date() },
    });
  }

  return { items: page, nextCursor };
}
