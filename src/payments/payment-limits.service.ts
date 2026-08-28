import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

const DEFAULT_DAILY_LIMIT = parseFloat(process.env.PAYMENT_DAILY_LIMIT_USDC ?? '5000');
const DEFAULT_MONTHLY_LIMIT = parseFloat(process.env.PAYMENT_MONTHLY_LIMIT_USDC ?? '50000');
const WHITELIST_USER_IDS = new Set((process.env.PAYMENT_LIMIT_WHITELIST ?? '').split(',').filter(Boolean));

@Injectable()
export class PaymentLimitsService {
  private readonly logger = new Logger(PaymentLimitsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async checkAndEnforce(userId: string, amountUsdc: number) {
    if (WHITELIST_USER_IDS.has(userId)) return { allowed: true, reason: 'whitelisted' };

    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dailyResult, monthlyResult] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amountUsdc: true },
        where: { commission: { clientId: userId }, status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.RELEASED] }, createdAt: { gte: dayStart } },
      }),
      this.prisma.payment.aggregate({
        _sum: { amountUsdc: true },
        where: { commission: { clientId: userId }, status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.RELEASED] }, createdAt: { gte: monthStart } },
      }),
    ]);

    const dailyTotal = Number(dailyResult._sum.amountUsdc ?? 0) + amountUsdc;
    const monthlyTotal = Number(monthlyResult._sum.amountUsdc ?? 0) + amountUsdc;

    if (dailyTotal > DEFAULT_DAILY_LIMIT) {
      throw new BadRequestException(`Daily payment limit of ${DEFAULT_DAILY_LIMIT} USDC exceeded`);
    }
    if (monthlyTotal > DEFAULT_MONTHLY_LIMIT) {
      throw new BadRequestException(`Monthly payment limit of ${DEFAULT_MONTHLY_LIMIT} USDC exceeded`);
    }

    this.logger.debug(`Limits OK — userId=${userId} daily=${dailyTotal}/${DEFAULT_DAILY_LIMIT} monthly=${monthlyTotal}/${DEFAULT_MONTHLY_LIMIT}`);
    return { allowed: true, dailyRemaining: DEFAULT_DAILY_LIMIT - dailyTotal, monthlyRemaining: DEFAULT_MONTHLY_LIMIT - monthlyTotal };
  }
}
