import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from './stellar.service';
import { CommissionStatus, PaymentStatus } from '@prisma/client';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000 * 10; // 10 seconds

@Injectable()
export class PaymentVerificationService {
  private readonly logger = new Logger(PaymentVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    const pendingPayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUBMITTED,
        retryCount: { lt: MAX_RETRIES },
        lastCheckedAt: {
          lt: new Date(Date.now() - RETRY_DELAY_MS),
        },
      },
      include: { commission: true },
    });

    for (const payment of pendingPayments) {
      this.logger.log(`Verifying payment ${payment.id}`);
      try {
        await this.verifyPayment(payment);
      } catch (error) {
        this.logger.error(`Failed to verify payment ${payment.id}`, error);
      }
    }
  }

  async verifyPayment(payment) {
    if (!payment.txHash) {
      this.logger.warn(`Payment ${payment.id} has no txHash`);
      return;
    }

    const txStatus = await this.stellar.verifyTransaction(payment.txHash);

    if (txStatus.status === 'SUCCESS') {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.CONFIRMED },
        }),
        this.prisma.commission.update({
          where: { id: payment.commissionId },
          data: { status: CommissionStatus.IN_PROGRESS },
        }),
      ]);
      this.logger.log(`Payment ${payment.id} confirmed`);
    } else if (txStatus.status === 'NOT_FOUND') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          retryCount: { increment: 1 },
          lastCheckedAt: new Date(),
        },
      });
      this.logger.log(`Payment ${payment.id} not found, will retry`);
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      this.logger.error(
        `Payment ${payment.id} failed with status ${txStatus.status}`,
      );
    }
  }
}
