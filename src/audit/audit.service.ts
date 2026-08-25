import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLog, User, Artist, Role, UserStatus } from '@prisma/client';
import { paginate } from '../common/utils/pagination.util';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit event
   * @param userId - The ID of the user who performed the action
   * @param action - The action that was performed
   * @param metadata - Additional metadata about the action
   * @param ip - The IP address of the user who performed the action
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
        metadata,
        ipAddress: ip,
      },
    });
  }

  /**
   * Get audit logs with filtering and pagination
   * @param filters - Filter criteria (userId, action, startDate, endDate)
   * @param page - Page number (default: 1)
   * @param limit - Number of items per page (default: 10)
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
    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    return paginate({
      page,
      limit,
      fetch: ({ skip, take }) =>
        this.prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
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
    const where: any = {};
    if (status) {
      where.status = status;
    }

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
        artist: {
          include: { user: { select: { id: true, name: true } } },
        },
        service: { select: { id: true, title: true } },
        payments: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      count: () => this.prisma.commission.count({ where }),
    });
  }

  async getAnalytics(from?: Date, to?: Date) {
    const dateFilter: any = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.gte = from;
      if (to) dateFilter.createdAt.lte = to;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Run all queries in parallel for performance
    const [
      totalArtists,
      totalClients,
      totalCommissions,
      commissionsByStatus,
      totalUsdcVolumeResult,
      openDisputes,
      newUsersToday,
    ] = await Promise.all([
      // Total artists
      this.prisma.artist.count({ where: dateFilter }),
      // Total clients
      this.prisma.user.count({ where: { ...dateFilter, role: 'CLIENT' } }),
      // Total commissions
      this.prisma.commission.count({ where: dateFilter }),
      // Commissions grouped by status
      this.prisma.commission.groupBy({
        by: ['status'],
        _count: true,
        where: dateFilter,
      }),
      // Total USDC volume (sum of all commission budgets in the date range)
      this.prisma.commission.aggregate({
        _sum: { budgetUsdc: true },
        where: dateFilter,
      }),
      // Open disputes (DISPUTED status)
      this.prisma.commission.count({ where: { ...dateFilter, status: 'DISPUTED' } }),
      // New users created today
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: today,
            lte: todayEnd,
          },
        },
      }),
    ]);

    // Format commissions by status into a clean object
    const formattedCommissionsByStatus = commissionsByStatus.reduce((acc, curr) => {
      acc[curr.status] = curr._count;
      return acc;
    }, {} as Record<string, number>);

    // Calculate total USDC volume
    const totalUsdcVolume = totalUsdcVolumeResult._sum.budgetUsdc 
      ? parseFloat(totalUsdcVolumeResult._sum.budgetUsdc.toString()) 
      : 0;

    return {
      totalArtists,
      totalClients,
      totalCommissions,
      commissionsByStatus: formattedCommissionsByStatus,
      totalUsdcVolume,
      openDisputes,
      newUsersToday,
      dateRange: {
        from: from?.toISOString() || 'all time',
        to: to?.toISOString() || 'present',
      },
    };
  }

  /**
   * Get users with filtering, search, and pagination
   * @param filters - Filter criteria (search, role, status)
   * @param page - Page number (default: 1)
   * @param limit - Number of items per page (default: 10)
   */
  async getUsers(
    filters: {
      search?: string;
      role?: Role;
      status?: UserStatus;
    } = {},
    page?: number | string,
    limit?: number | string,
  ) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return paginate({
      page,
      limit,
      fetch: ({ skip, take }) =>
        this.prisma.user.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          artist: {
            select: {
              id: true,
              isVerified: true,
            },
          },
        },
        }),
      count: () => this.prisma.user.count({ where }),
    });
  }

  /**
   * Update user status
   * @param id - User ID
   * @param status - New user status
   */
  async updateUserStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });
  }

  /**
   * Get artists pending verification
   * @param page - Page number (default: 1)
   * @param limit - Number of items per page (default: 10)
   */
  async getPendingVerificationArtists(
    page?: number | string,
    limit?: number | string,
  ) {
    const where = {
      isVerified: false,
    };

    return paginate({
      page,
      limit,
      fetch: ({ skip, take }) =>
        this.prisma.artist.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        }),
      count: () => this.prisma.artist.count({ where }),
    });
  }

  /**
   * Verify or revoke verification for an artist
   * @param id - Artist ID
   * @param isVerified - Whether to grant or revoke verification
   */
  async verifyArtist(id: string, isVerified: boolean): Promise<Artist> {
    return this.prisma.artist.update({
      where: { id },
      data: {
        isVerified,
        verifiedAt: isVerified ? new Date() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }
}