import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateConversationDto,
  SearchMessagesDto,
  SendMessageDto,
} from './dto/messaging.dto';

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (!conversation.participantIds.includes(userId)) {
      throw new ForbiddenException('Not a participant in this conversation');
    }
    return conversation;
  }

  /** Start a conversation (or return an existing 1:1 thread with the same set). */
  async createConversation(userId: string, dto: CreateConversationDto) {
    const participantIds = Array.from(new Set([userId, ...dto.participantIds]));
    return this.prisma.conversation.create({
      data: {
        participantIds,
        commissionId: dto.commissionId,
      },
    });
  }

  /** List the caller's conversations, most-recently-active first. */
  async listConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { participantIds: { has: userId } },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 30,
  ) {
    await this.requireParticipant(conversationId, userId);
    const [total, data] = await this.prisma.$transaction([
      this.prisma.message.count({ where: { conversationId } }),
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.requireParticipant(conversationId, userId);
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: dto.content,
        attachmentUrl: dto.attachmentUrl,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Real-time-style delivery: notify every other participant in-app.
    const recipients = conversation.participantIds.filter(
      (id) => id !== userId,
    );
    await Promise.all(
      recipients.map((recipientId) =>
        this.notifications.notify(recipientId, {
          type: 'MESSAGE_RECEIVED',
          title: 'New message',
          message: dto.content.slice(0, 140),
          metadata: { conversationId, messageId: message.id },
        }),
      ),
    );
    return message;
  }

  async updateMessage(userId: string, messageId: string, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    return this.prisma.message.update({
      where: { id: messageId },
      data: { content },
    });
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }
    await this.prisma.message.delete({ where: { id: messageId } });
    return { deleted: true };
  }

  /** Mark all messages the caller received in a conversation as read. */
  async markRead(userId: string, conversationId: string) {
    await this.requireParticipant(conversationId, userId);
    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });
    return { markedRead: result.count };
  }

  /** Total unread messages addressed to the caller across all conversations. */
  async unreadCount(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { participantIds: { has: userId } },
      select: { id: true },
    });
    const count = await this.prisma.message.count({
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderId: { not: userId },
        isRead: false,
      },
    });
    return { unread: count };
  }

  /** Full-text-ish search over the caller's own conversations. */
  async search(userId: string, dto: SearchMessagesDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const conversations = await this.prisma.conversation.findMany({
      where: { participantIds: { has: userId } },
      select: { id: true },
    });
    const where = {
      conversationId: { in: conversations.map((c) => c.id) },
      content: { contains: dto.q, mode: 'insensitive' as const },
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
