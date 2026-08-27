import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BulkNotificationDto,
  CreateNotificationDto,
  NotificationChannel,
  QueryNotificationsDto,
  SendFromTemplateDto,
  UpdatePreferencesDto,
  UpsertTemplateDto,
} from './dto/notifications.dto';

interface NotifyInput {
  type: string;
  title: string;
  message: string;
  channel?: NotificationChannel;
  metadata?: Record<string, unknown>;
  scheduledFor?: Date | string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Core delivery primitive used across the app. Honours the recipient's
   * channel preferences and muted types; defers delivery when scheduledFor is
   * in the future. Returns the created notification, or null when suppressed.
   */
  async notify(userId: string, input: NotifyInput) {
    const channel = input.channel ?? 'IN_APP';
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (prefs) {
      if (prefs.mutedTypes.includes(input.type)) return null;
      const channelEnabled: Record<NotificationChannel, boolean> = {
        IN_APP: prefs.inAppEnabled,
        EMAIL: prefs.emailEnabled,
        PUSH: prefs.pushEnabled,
      };
      if (!channelEnabled[channel]) return null;
    }

    const scheduledFor = input.scheduledFor
      ? new Date(input.scheduledFor)
      : null;
    const isDeferred =
      scheduledFor !== null && scheduledFor.getTime() > Date.now();

    return this.prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        channel,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue,
        scheduledFor,
        sentAt: isDeferred ? null : new Date(),
      },
    });
  }

  async create(dto: CreateNotificationDto) {
    return this.notify(dto.userId, dto);
  }

  async bulkSend(dto: BulkNotificationDto) {
    const results = await Promise.all(
      dto.userIds.map((userId) =>
        this.notify(userId, {
          type: dto.type,
          title: dto.title,
          message: dto.message,
          channel: dto.channel,
        }),
      ),
    );
    return {
      requested: dto.userIds.length,
      delivered: results.filter(Boolean).length,
    };
  }

  async listForUser(userId: string, query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationWhereInput = { userId };
    if (query.isRead !== undefined) where.isRead = query.isRead;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
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

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { markedRead: res.count };
  }

  async unreadCount(userId: string) {
    const unread = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unread };
  }

  async remove(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    await this.prisma.notification.delete({ where: { id } });
    return { deleted: true };
  }

  // --- Preferences ---------------------------------------------------------

  async getPreferences(userId: string) {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    return (
      prefs ?? {
        userId,
        emailEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        mutedTypes: [],
      }
    );
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  // --- Templates -----------------------------------------------------------

  async upsertTemplate(dto: UpsertTemplateDto) {
    return this.prisma.notificationTemplate.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        title: dto.title,
        body: dto.body,
        channel: dto.channel ?? 'IN_APP',
      },
      update: {
        title: dto.title,
        body: dto.body,
        channel: dto.channel ?? 'IN_APP',
      },
    });
  }

  async listTemplates() {
    return this.prisma.notificationTemplate.findMany({
      orderBy: { key: 'asc' },
    });
  }

  /** Replace {{token}} placeholders using the provided variable map. */
  private render(template: string, variables: Record<string, string> = {}) {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) =>
      key in variables ? variables[key] : `{{${key}}}`,
    );
  }

  async sendFromTemplate(dto: SendFromTemplateDto) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { key: dto.key },
    });
    if (!template) {
      throw new NotFoundException(`Template '${dto.key}' not found`);
    }
    return this.notify(dto.userId, {
      type: dto.type,
      title: this.render(template.title, dto.variables),
      message: this.render(template.body, dto.variables),
      channel: template.channel as NotificationChannel,
    });
  }

  // --- Scheduling & analytics ---------------------------------------------

  /** Dispatch any scheduled notifications that are now due. */
  async processScheduled(now: Date = new Date()) {
    const due = await this.prisma.notification.findMany({
      where: { sentAt: null, scheduledFor: { lte: now } },
      select: { id: true },
    });
    if (due.length === 0) return { dispatched: 0 };
    await this.prisma.notification.updateMany({
      where: { id: { in: due.map((d) => d.id) } },
      data: { sentAt: now },
    });
    return { dispatched: due.length };
  }

  async analytics() {
    const [total, unread, byType, byChannel, scheduledPending] =
      await this.prisma.$transaction([
        this.prisma.notification.count(),
        this.prisma.notification.count({ where: { isRead: false } }),
        this.prisma.notification.groupBy({
          by: ['type'],
          _count: true,
          orderBy: { type: 'asc' },
        }),
        this.prisma.notification.groupBy({
          by: ['channel'],
          _count: true,
          orderBy: { channel: 'asc' },
        }),
        this.prisma.notification.count({
          where: { sentAt: null, scheduledFor: { not: null } },
        }),
      ]);
    return {
      total,
      read: total - unread,
      unread,
      scheduledPending,
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      byChannel: byChannel.map((c) => ({
        channel: c.channel,
        count: c._count,
      })),
    };
  }
}
