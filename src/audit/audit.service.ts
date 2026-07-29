import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLog, User, Artist, Role, UserStatus } from '@prisma/client';

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
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
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

    const skip = (page - 1) * limit;

    const [auditLogs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
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
      this.prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: auditLogs,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getAllCommissions(status?: CommissionStatus) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return this.prisma.commission.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true } },
        artist: {
          include: { user: { select: { id: true, name: true } } },
        },
        service: { select: { id: true, title: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
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

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
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
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages,
    };
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
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Artist[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where = {
      isVerified: false,
    };

    const skip = (page - 1) * limit;

    const [artists, total] = await Promise.all([
      this.prisma.artist.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
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
      this.prisma.artist.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: artists,
      total,
      page,
      limit,
      totalPages,
    };
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