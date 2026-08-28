import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, AuditLog, Artist, Role, UserStatus, CommissionStatus } from '@prisma/client';
import { paginate } from '../common/utils/pagination.util';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit event for any data modification (#653).
   * Call this from any service that creates, updates, or deletes a record.
   */
  async log(
    userId: string,
    action: string,
    metadata?: Record<string, any>,
    ip?: string,
  ): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        metadata: metadata ?? {},
        ipAddress: ip,
      },
    });
  }

  /**
   * Convenience helper: log a CREATE event (#653).
   */
  async logCreate(
    userId: string,
    entity: string,
    entityId: string,
    metadata?: Record<string, any>,
    ip?: string,
  ) {
    return this.log(userId, `${entity}.CREATED`, { entityId, ...metadata }, ip);
  }

  /**
   * Convenience helper: log an UPDATE event (#653).
   */
  async logUpdate(
    userId: string,
    entity: string,
    entityId: string,
    changes: Record<string, unknown>,
    ip?: string,
  ) {
    return this.log(userId, `${entity}.UPDATED`, { entityId, changes }, ip);
  }

  /**
   * Convenience helper: log a DELETE (or soft-delete) event (#653).
   */
  async logDelete(
    userId: string,
    entity: string,
    entityId: string,
    soft = true,
    ip?: string,
  ) {
    return this.log(userId, soft ? `${entity}.SOFT_DELETED` : `${entity}.DELETED`, { entityId }, ip);
  }

  /**
   * Get audit logs with filtering and pagination.
   */
  async getAuditLogs(
    filters: {
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
    page?: number | string,
    limit?: number | string,
  ) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }

    return paginate({
      page,
      limit,
      fetch: ({ skip, take }) =>
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        }),
      count: () => this.prisma.auditLog.count({ where }),
    });
  }

  async getAllCommissions(
    status?: CommissionStatus,
    page?: number | string,
    limit?: number | string,
  ) {
    const where: Prisma.CommissionWhereInput = {};
    if (status) where.status = status;

    return paginate({
      page,
      limit,
      fetch: ({ skip, take }) =>
        this.prisma.commission.findMany({
          where,
          skip,
          take,
          include: {
            client: { select: { id: true, name: true, email: true } },
            artist: { include: { user: { select: { id: true, name: true } } } },
            service: { select: { id: true, title: true } },
            payments: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      count: () => this.prisma.commission.count({ where }),
    });
  }

  async getAnalytics(from?: Date, to?: Date) {
    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (from || to) {
      dateFilter.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalArtists,
      totalClients,
      totalCommissions,
      commissionsByStatus,
      totalUsdcVolumeResult,
      openDisputes,
      newUsersToday,
    ] = await Promise.all([
      this.prisma.artist.count({ where: dateFilter }),
      this.prisma.user.count({ where: { ...dateFilter, role: Role.CLIENT } }),
      this.prisma.commission.count({ where: dateFilter }),
      this.prisma.commission.groupBy({ by: ['status'], _count: true, where: dateFilter }),
      this.prisma.commission.aggregate({ _sum: { budgetUsdc: true }, where: dateFilter }),
      this.prisma.commission.count({ where: { ...dateFilter, status: CommissionStatus.DISPUTED } }),
      this.prisma.user.count({ where: { createdAt: { gte: today, lte: todayEnd } } }),
    ]);

    return {
      totalArtists,
      totalClients,
      totalCommissions,
      commissionsByStatus: commissionsByStatus.reduce((acc, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      }, {} as Record<string, number>),
      totalUsdcVolume: totalUsdcVolumeResult._sum.budgetUsdc
        ? parseFloat(totalUsdcVolumeResult._sum.budgetUsdc.toString())
        : 0,
      openDisputes,
      newUsersToday,
      dateRange: { from: from?.toISOString() || 'all time', to: to?.toISOString() || 'present' },
    };
  }

  async getUsers(
    filters: { search?: string; role?: Role; status?: UserStatus } = {},
    page?: number | string,
    limit?: number | string,
  ) {
    const where: Prisma.UserWhereInput = {};
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;

    return paginate({
      page,
      limit,
      fetch: ({ skip, take }) =>
        this.prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          select: {
            id: true, email: true, name: true, role: true, status: true,
            createdAt: true, updatedAt: true,
            artist: { select: { id: true, isVerified: true } },
          },
        }),
      count: () => this.prisma.user.count({ where }),
    });
  }

  async updateUserStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
  }

  async getPendingVerificationArtists(page?: number | string, limit?: number | string) {
    return paginate({
      page,
      limit,
      fetch: ({ skip, take }) =>
        this.prisma.artist.findMany({
          where: { isVerified: false },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: { user: { select: { id: true, email: true, name: true } } },
        }),
      count: () => this.prisma.artist.count({ where: { isVerified: false } }),
    });
  }

  async verifyArtist(id: string, isVerified: boolean): Promise<Artist> {
    return this.prisma.artist.update({
      where: { id },
      data: { isVerified, verifiedAt: isVerified ? new Date() : null },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }
}
