import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CommissionStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from './stellar.service';
import { InitiateEscrowDto } from './dto/initiate-escrow.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

/** Platform fee expressed as a fraction (2 %). */
const PLATFORM_FEE_RATE = 0.02;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Issue #464 — POST /payments/commissions/:id/escrow
  // ──────────────────────────────────────────────────────────────────────────

  async initiateEscrow(commissionId: string, dto: InitiateEscrowDto) {
    if (dto.assetCode !== 'XLM' && !dto.assetIssuer) {
      throw new BadRequestException(
        `assetIssuer is required for asset ${dto.assetCode}`,
      );
    }

    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
      include: { artist: { include: { user: true } } },
    });

    if (!commission) {
      throw new NotFoundException(`Commission ${commissionId} not found`);
    }

    // Retrieve wallet addresses
    const artistWallet = commission.artist.user?.walletAddress ?? '';
    const platformWallet = this.stellar.getPlatformPublicKey();

    if (!platformWallet) {
      throw new BadRequestException('Platform wallet is not configured');
    }

    const artistWalletForTx = artistWallet || platformWallet;

    // Build the unsigned transaction
    const amountStr = dto.amount.toFixed(7);
    const unsignedXdr = await this.stellar.buildEscrowCreationTx(
      dto.clientWallet,
      artistWalletForTx,
      amountStr,
      dto.assetCode,
      commissionId,
    );

    const platformFee = dto.amount * PLATFORM_FEE_RATE;

    const payment = await this.prisma.payment.create({
      data: {
        commissionId,
        milestoneId: dto.milestoneId ?? null,
        clientWallet: dto.clientWallet,
        artistWallet,
        amountUsdc: dto.amount,
        platformFeeUsdc: platformFee,
        assetCode: dto.assetCode,
        status: PaymentStatus.PENDING,
      },
    });

    this.logger.log(
      `Escrow initiated — paymentId=${payment.id} commissionId=${commissionId}`,
    );

    return {
      paymentId: payment.id,
      unsignedXdr,
      amount: dto.amount,
      assetCode: dto.assetCode,
      platformFee,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Issue #469 — POST /payments/confirm
  // ──────────────────────────────────────────────────────────────────────────

  async confirmPayment(dto: ConfirmPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { commission: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${dto.paymentId} not found`);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Payment is already in status ${payment.status}`,
      );
    }

    let txHash: string;
    let success = false;

    try {
      const result = await this.stellar.submitTransaction(dto.signedXdr);
      txHash = result.txHash;
      success = result.successful;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Transaction submission failed';

      this.logger.error(
        `Transaction failed — paymentId=${dto.paymentId}: ${message}`,
      );

      await this.prisma.payment.update({
        where: { id: dto.paymentId },
        data: { status: PaymentStatus.FAILED },
      });

      throw new BadRequestException(`Transaction submission failed: ${message}`);
    }

    if (!success) {
      await this.prisma.payment.update({
        where: { id: dto.paymentId },
        data: { status: PaymentStatus.FAILED },
      });
      throw new BadRequestException('Stellar transaction did not succeed');
    }

    const [updatedPayment] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: dto.paymentId },
        data: {
          status: PaymentStatus.CONFIRMED,
          txHash,
        },
      }),
      this.prisma.commission.update({
        where: { id: payment.commissionId },
        data: { status: CommissionStatus.IN_PROGRESS },
      }),
    ]);

    this.logger.log(
      `Payment confirmed — paymentId=${dto.paymentId} txHash=${txHash}`,
    );

    return {
      paymentId: updatedPayment.id,
      txHash,
      status: updatedPayment.status,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Issue #470 — POST /payments/commissions/:id/release
  // ──────────────────────────────────────────────────────────────────────────

  async releasePayment(commissionId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
      include: {
        payments: {
          where: { status: PaymentStatus.CONFIRMED },
          orderBy: { createdAt: 'desc' },
        },
        artist: { include: { user: true } },
      },
    });

    if (!commission) {
      throw new NotFoundException(`Commission ${commissionId} not found`);
    }

    if (commission.status !== CommissionStatus.COMPLETED) {
      throw new BadRequestException(
        'Payment can only be released for COMPLETED commissions',
      );
    }

    const payment = commission.payments[0];
    if (!payment) {
      throw new NotFoundException(
        'No confirmed payment found for this commission',
      );
    }

    const artistWallet =
      commission.artist.user?.walletAddress ?? payment.artistWallet;

    if (!artistWallet) {
      throw new BadRequestException('Artist has no registered wallet address');
    }

    const gross = Number(payment.amountUsdc);
    const fee = Number(payment.platformFeeUsdc);

    const { txHash } = await this.stellar.releaseFundsOnChain(
      artistWallet,
      gross,
      fee,
      payment.assetCode,
      commissionId,
    );

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.RELEASED,
        txHash,
        artistWallet,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: commission.artist.userId,
        type: 'PAYMENT_RELEASED',
        title: 'Payment Released',
        message: `Your payment of ${gross - fee} ${payment.assetCode} for commission "${commission.title}" has been released.`,
        metadata: { txHash, paymentId: payment.id },
      },
    });

    this.logger.log(
      `Payment released — paymentId=${payment.id} artistWallet=${artistWallet} txHash=${txHash}`,
    );

    return {
      paymentId: updatedPayment.id,
      txHash,
      status: updatedPayment.status,
      netAmount: gross - fee,
      assetCode: payment.assetCode,
    };
  }
}
