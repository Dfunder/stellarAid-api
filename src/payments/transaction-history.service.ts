import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, Prisma } from '@prisma/client';
import { paginate } from '../common/utils/pagination.util';

export interface TransactionHistoryFilters {
  userId?: string; status?: PaymentStatus; assetCode?: string;
  from?: Date; to?: Date; search?: string;
}

@Injectable()
export class TransactionHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(filters: TransactionHistoryFilters, page = 1, limit = 20) {
    const where: Prisma.PaymentWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.assetCode) where.assetCode = filters.assetCode;
    if (filters.from || filters.to) {
      where.createdAt = { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) };
    }
    if (filters.userId) {
      where.OR = [{ commission: { clientId: filters.userId } }, { commission: { artistId: filters.userId } }];
    }
    if (filters.search) {
      where.txHash = { contains: filters.search, mode: 'insensitive' };
    }
    return paginate({
      page, limit,
      fetch: ({ skip, take }) => this.prisma.payment.findMany({ where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: { commission: { select: { id: true, title: true, clientId: true, artistId: true } } } }),
      count: () => this.prisma.payment.count({ where }),
    });
  }

  async getCategorizationSummary(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { OR: [{ commission: { clientId: userId } }, { commission: { artistId: userId } }] },
    });
    const byStatus: Record<string, number> = {};
    const byAsset: Record<string, number> = {};
    for (const p of payments) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      byAsset[p.assetCode] = (byAsset[p.assetCode] ?? 0) + Number(p.amountUsdc);
    }
    return { totalTransactions: payments.length, byStatus, byAsset };
  }
}
