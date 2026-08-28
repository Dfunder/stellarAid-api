import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const RETENTION = {
  auditLog: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? '365', 10),
  notification: parseInt(process.env.NOTIFICATION_RETENTION_DAYS ?? '90', 10),
};

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_WEEK)
  async runRetentionCleanup() {
    const now = new Date();
    const auditCutoff = new Date(now.getTime() - RETENTION.auditLog * 86400000);
    const { count: auditDeleted } = await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } });
    const notifCutoff = new Date(now.getTime() - RETENTION.notification * 86400000);
    const { count: notifDeleted } = await this.prisma.notification.deleteMany({ where: { createdAt: { lt: notifCutoff }, isRead: true } });
    this.logger.log(`Retention cleanup — auditLogs=${auditDeleted} notifications=${notifDeleted}`);
    return { cleanedAt: now, auditLogs: auditDeleted, notifications: notifDeleted };
  }

  getRetentionPolicy() {
    return { ...RETENTION, unit: 'days', gdprNote: 'Users may request data deletion via DELETE /users/me' };
  }
}
