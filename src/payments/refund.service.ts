import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { StellarService } from './stellar.service';

export interface RefundRequestDto {
  paymentId: string;
  reason: string;
  /** Optional: amount to refund; defaults to full payment amount. */
  amountUsdc?: number;
}

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  /** Create a refund request for admin review (#638). */
  async requestRefund(clientId: string, dto: RefundRequestDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { commission: { include: { client: true } } },
    });
    if (!payment) throw new NotFoundException(`Payment ${dto.paymentId} not found`);
    if (payment.commission.clientId !== clientId) {
      throw new BadRequestException('You do not have permission to request a refund for this payment');
    }
    if (payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Payment has already been refunded');
    }
    if (![PaymentStatus.CONFIRMED, PaymentStatus.RELEASED].includes(payment.status)) {
      throw new BadRequestException(`Refunds can only be requested for CONFIRMED or RELEASED payments`);
    }

    const refundAmount = dto.amountUsdc ?? Number(payment.amountUsdc);
    const fullAmount = Number(payment.amountUsdc);
    if (refundAmount > fullAmount) {
      throw new BadRequestException(`Refund amount ${refundAmount} exceeds payment amount ${fullAmount}`);
    }

    const isPartial = refundAmount < fullAmount;

    // Notify admin
    await this.prisma.notification.create({
      data: {
        userId: clientId,
        type: 'REFUND_REQUESTED',
        title: isPartial ? 'Partial Refund Requested' : 'Refund Requested',
        message: `A ${isPartial ? 'partial ' : ''}refund of ${refundAmount} ${payment.assetCode} has been requested for payment ${dto.paymentId}.`,
        metadata: { paymentId: dto.paymentId, reason: dto.reason, refundAmount },
      },
    });

    this.logger.log(`Refund requested — paymentId=${dto.paymentId} amount=${refundAmount} partial=${isPartial}`);
    return { paymentId: dto.paymentId, refundAmount, isPartial, status: 'PENDING_APPROVAL' };
  }

  /** Process an approved refund (#638). Called by admin. */
  async processRefund(paymentId: string, refundAmountUsdc?: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { commission: true },
    });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);

    const amount = refundAmountUsdc ?? Number(payment.amountUsdc);
    const { txHash } = await this.stellar.refundFundsOnChain(
      payment.clientWallet,
      amount,
      payment.assetCode,
      payment.commissionId,
    );

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.REFUNDED, txHash },
    });

    // Audit trail
    this.logger.log(`Refund processed — paymentId=${paymentId} txHash=${txHash} amount=${amount}`);

    // Notify client
    await this.prisma.notification.create({
      data: {
        userId: payment.commission.clientId,
        type: 'REFUND_PROCESSED',
        title: 'Refund Processed',
        message: `Your refund of ${amount} ${payment.assetCode} has been processed. Tx: ${txHash}`,
        metadata: { paymentId, txHash, amount },
      },
    });

    return { paymentId: updated.id, txHash, refundAmount: amount, status: updated.status };
  }
}
