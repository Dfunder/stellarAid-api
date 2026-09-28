/**
 * Messaging threads (#838, #839).
 */

import type { Message, MessageThread } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services/prisma.service';

export const MESSAGE_MAX_LENGTH = 5000;

export interface ThreadListItem {
  id: string;
  updatedAt: Date;
  createdAt: Date;
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    createdAt: Date;
  } | null;
  unreadCount: number;
  participantIds: string[];
}

async function assertParticipant(threadId: string, userId: string): Promise<void> {
  const row = await prisma.threadParticipant.findUnique({
    where: { threadId_userId: { threadId, userId } },
  });
  if (row === null) {
    throw new AppError('FORBIDDEN', 'You are not a participant in this thread');
  }
}

export async function sendMessage(
  threadId: string,
  senderId: string,
  body: string,
): Promise<Message> {
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

  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    include: { participants: true },
  });
  if (thread === null) {
    throw new AppError('NOT_FOUND', 'Thread not found');
  }
  const isParticipant = thread.participants.some((p) => p.userId === senderId);
  if (!isParticipant) {
    throw new AppError('FORBIDDEN', 'You are not a participant in this thread');
  }

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        threadId,
        senderId,
        body: trimmed,
      },
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

export async function listUserThreads(userId: string): Promise<ThreadListItem[]> {
  const memberships = await prisma.threadParticipant.findMany({
    where: { userId },
    include: {
      thread: {
        include: {
          participants: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
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
      participantIds: thread.participants.map((p) => p.userId),
    });
  }

  items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return items;
}

export async function listThreadMessages(
  threadId: string,
  userId: string,
  options?: { limit?: number; cursor?: string },
): Promise<{
  items: Message[];
  nextCursor: string | null;
}> {
  await assertParticipant(threadId, userId);

  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);

  const messages = await prisma.message.findMany({
    where: {
      threadId,
      ...(options?.cursor
        ? { createdAt: { gt: new Date(options.cursor) } }
        : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit + 1,
  });

  const page = messages.slice(0, limit);
  const nextCursor =
    messages.length > limit
      ? page[page.length - 1]!.createdAt.toISOString()
      : null;

  // Mark messages from others as read on fetch (#839).
  await prisma.message.updateMany({
    where: {
      threadId,
      senderId: { not: userId },
      readAt: null,
      id: { in: page.map((m) => m.id) },
    },
    data: { readAt: new Date() },
  });

  return { items: page, nextCursor };
}
