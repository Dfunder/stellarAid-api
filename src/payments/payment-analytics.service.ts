import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPaymentMetrics(from?: Date, to?: Date) {
    const dateFilter = from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
    const [total, confirmed, failed, released, refunded, volumeResult] = await Promise.all([
      this.prisma.payment.count({ where: dateFilter }),
      this.prisma.payment.count({ where: { ...dateFilter, status: PaymentStatus.CONFIRMED } }),
      this.prisma.payment.count({ where: { ...dateFilter, status: PaymentStatus.FAILED } }),
      this.prisma.payment.count({ where: { ...dateFilter, status: PaymentStatus.RELEASED } }),
      this.prisma.payment.count({ where: { ...dateFilter, status: PaymentStatus.REFUNDED } }),
      this.prisma.payment.aggregate({ _sum: { amountUsdc: true, platformFeeUsdc: true }, where: { ...dateFilter, status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.RELEASED] } } }),
    ]);
    const successRate = total > 0 ? ((confirmed + released) / total * 100).toFixed(1) : '0.0';
    return {
      total, confirmed, failed, released, refunded,
      successRate: `${successRate}%`,
      totalVolume: Number(volumeResult._sum.amountUsdc ?? 0),
      totalFees: Number(volumeResult._sum.platformFeeUsdc ?? 0),
      period: { from: from?.toISOString() ?? 'all', to: to?.toISOString() ?? 'now' },
    };
  }

  async getArtistEarnings(artistId: string) {
    const result = await this.prisma.payment.aggregate({
      where: { commission: { artistId }, status: PaymentStatus.RELEASED },
      _sum: { amountUsdc: true, platformFeeUsdc: true },
    });
    const gross = Number(result._sum.amountUsdc ?? 0);
    const fees = Number(result._sum.platformFeeUsdc ?? 0);
    return { artistId, grossEarnings: gross, fees, netEarnings: gross - fees };
  }

  async getPlatformRevenue(from?: Date, to?: Date) {
    const dateFilter = from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
    const result = await this.prisma.payment.aggregate({
      _sum: { platformFeeUsdc: true },
      where: { ...dateFilter, status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.RELEASED] } },
    });
    return { totalFees: Number(result._sum.platformFeeUsdc ?? 0), period: { from, to } };
  }
}
