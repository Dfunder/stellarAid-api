import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLog } from '@prisma/client';

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
}