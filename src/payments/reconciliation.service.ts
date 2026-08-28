import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

export interface ReconciliationResult {
  checkedAt: Date;
  totalChecked: number;
  matched: number;
  discrepancies: Array<{ paymentId: string; dbStatus: string; onChain: boolean; action: string }>;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private readonly horizonUrl = process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

  constructor(private readonly prisma: PrismaService) {}

  /** Daily reconciliation job (#639) — compares DB payment status with blockchain. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyReconciliation(): Promise<ReconciliationResult> {
    const checkedAt = new Date();
    const payments = await this.prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.CONFIRMED, PaymentStatus.RELEASED] },
        txHash: { not: null },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      take: 200,
    });

    const discrepancies: ReconciliationResult['discrepancies'] = [];
    let matched = 0;

    await Promise.allSettled(
      payments.map(async (payment) => {
        try {
          const onChain = await this.verifyOnChain(payment.txHash!);
          if (onChain) {
            matched++;
          } else {
            discrepancies.push({
              paymentId: payment.id,
              dbStatus: payment.status,
              onChain: false,
              action: 'FLAGGED_FOR_REVIEW',
            });
            this.logger.warn(`Reconciliation discrepancy — paymentId=${payment.id} txHash=${payment.txHash}`);
          }
        } catch {
          // Network error — skip this payment, retry tomorrow
        }
      }),
    );

    this.logger.log(`Reconciliation complete — checked=${payments.length} matched=${matched} discrepancies=${discrepancies.length}`);
    return { checkedAt, totalChecked: payments.length, matched, discrepancies };
  }

  /** Get reconciliation report data (manual trigger) (#639). */
  async getReport(from?: Date, to?: Date) {
    const where = {
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    };
    const [total, confirmed, released, failed, refunded] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.CONFIRMED } }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.RELEASED } }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.FAILED } }),
      this.prisma.payment.count({ where: { ...where, status: PaymentStatus.REFUNDED } }),
    ]);
    return { total, confirmed, released, failed, refunded, generatedAt: new Date() };
  }

  private async verifyOnChain(txHash: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.horizonUrl}/transactions/${txHash}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { successful?: boolean };
      return data.successful === true;
    } catch {
      return false;
    }
  }
}
