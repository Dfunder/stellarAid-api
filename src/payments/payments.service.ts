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
import { ResolveDisputeDto, DisputeResolution } from '../audit/dto/resolve-dispute.dto';

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

    const artistWallet = commission.artist.user?.walletAddress ?? '';
    const platformWallet = this.stellar.getPlatformPublicKey();

    if (!platformWallet) {
      throw new BadRequestException('Platform wallet is not configured');
    }

    const artistWalletForTx = artistWallet || platformWallet;

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

  async resolveDispute(commissionId: string, dto: ResolveDisputeDto) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
      include: {
        payments: {
          where: { status: PaymentStatus.CONFIRMED },
          orderBy: { createdAt: 'desc' },
        },
        artist: { include: { user: true } },
        client: true,
      },
    });

    if (!commission) {
      throw new NotFoundException(`Commission ${commissionId} not found`);
    }

    if (commission.status !== CommissionStatus.DISPUTED) {
      throw new BadRequestException('Only disputed commissions can be resolved');
    }

    const payment = commission.payments[0];
    if (!payment) {
      throw new NotFoundException('No confirmed payment found for this commission');
    }

    const artistWallet = commission.artist.user?.walletAddress ?? payment.artistWallet;
    const clientWallet = payment.clientWallet;

    if (!clientWallet) {
      throw new BadRequestException('Client has no registered wallet address');
    }

    const gross = Number(payment.amountUsdc);
    const fee = Number(payment.platformFeeUsdc);
    let txHash: string;
    let paymentStatus: PaymentStatus;
    let newCommissionStatus: CommissionStatus = CommissionStatus.COMPLETED;

    switch (dto.resolution) {
      case DisputeResolution.REFUND:
        // Refund entire amount to client
        const refundResult = await this.stellar.refundFundsOnChain(
          clientWallet,
          gross,
          payment.assetCode,
          commissionId,
        );
        txHash = refundResult.txHash;
        paymentStatus = PaymentStatus.REFUNDED;
        newCommissionStatus = CommissionStatus.CANCELLED;
        
        // Create client notification
        await this.prisma.notification.create({
          data: {
            userId: commission.clientId,
            type: 'PAYMENT_REFUNDED',
            title: 'Payment Refunded',
            message: `Your payment of ${gross} ${payment.assetCode} for commission "${commission.title}" has been refunded.`,
            metadata: { txHash, paymentId: payment.id },
          },
        });
        break;

      case DisputeResolution.RELEASE:
        // Release full amount to artist (same as standard release)
        const releaseResult = await this.stellar.releaseFundsOnChain(
          artistWallet,
          gross,
          fee,
          payment.assetCode,
          commissionId,
        );
        txHash = releaseResult.txHash;
        paymentStatus = PaymentStatus.RELEASED;
        
        // Create artist notification
        await this.prisma.notification.create({
          data: {
            userId: commission.artist.userId,
            type: 'PAYMENT_RELEASED',
            title: 'Payment Released',
            message: `Your payment of ${gross - fee} ${payment.assetCode} for commission "${commission.title}" has been released.`,
            metadata: { txHash, paymentId: payment.id },
          },
        });
        break;

      case DisputeResolution.PARTIAL:
        if (dto.artistShareBps === undefined || dto.artistShareBps < 0 || dto.artistShareBps > 10000) {
          throw new BadRequestException('artistShareBps is required for PARTIAL resolution and must be between 0 and 10000');
        }
        if (!artistWallet) {
          throw new BadRequestException('Artist has no registered wallet address');
        }
        // Split funds based on artistShareBps (basis points, 10000 = 100%)
        const partialResult = await this.stellar.partialReleaseFundsOnChain(
          artistWallet,
          clientWallet,
          gross,
          dto.artistShareBps,
          fee,
          payment.assetCode,
          commissionId,
        );
        txHash = partialResult.txHash;
        paymentStatus = PaymentStatus.RELEASED;
        
        // Notify both parties
        const artistAmount = (gross * dto.artistShareBps / 10000) - fee;
        const clientAmount = gross * (10000 - dto.artistShareBps) / 10000;
        await Promise.all([
          this.prisma.notification.create({
            data: {
              userId: commission.artist.userId,
              type: 'PARTIAL_PAYMENT_RELEASED',
              title: 'Partial Payment Released',
              message: `Your partial payment of ${artistAmount} ${payment.assetCode} for commission "${commission.title}" has been released.`,
              metadata: { txHash, paymentId: payment.id, artistShareBps: dto.artistShareBps },
            },
          }),
          this.prisma.notification.create({
            data: {
              userId: commission.clientId,
              type: 'PARTIAL_REFUND_PROCESSED',
              title: 'Partial Refund Processed',
              message: `Your partial refund of ${clientAmount} ${payment.assetCode} for commission "${commission.title}" has been processed.`,
              metadata: { txHash, paymentId: payment.id, clientShareBps: 10000 - dto.artistShareBps },
            },
          })
        ]);
        break;

      default:
        throw new BadRequestException('Invalid dispute resolution');
    }

    // Update payment and commission status
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus,
          txHash,
        },
      }),
      this.prisma.commission.update({
        where: { id: commissionId },
        data: { status: newCommissionStatus },
      }),
    ]);

    this.logger.log(
      `Dispute resolved — commissionId=${commissionId} resolution=${dto.resolution} paymentId=${payment.id} txHash=${txHash}`,
    );

    return {
      paymentId: payment.id,
      commissionId,
      resolution: dto.resolution,
      txHash,
      paymentStatus,
      commissionStatus: newCommissionStatus,
    };
  }
}