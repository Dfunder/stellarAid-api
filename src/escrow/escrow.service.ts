import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EscrowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEscrowDto } from './dto/escrow.dto';

@Injectable()
export class EscrowService {
  constructor(private readonly prisma: PrismaService) {}

  private async isParty(commissionId: string, userId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
      include: { artist: { select: { userId: true } } },
    });
    if (!commission) {
      throw new NotFoundException('Commission not found');
    }
    return (
      commission.clientId === userId || commission.artist.userId === userId
    );
  }

  /** Place funds into escrow (hold) and open the audit trail. */
  async hold(dto: CreateEscrowDto) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: dto.commissionId },
      select: { id: true },
    });
    if (!commission) {
      throw new NotFoundException('Commission not found');
    }
    return this.prisma.escrow.create({
      data: {
        commissionId: dto.commissionId,
        milestoneId: dto.milestoneId,
        amountUsdc: dto.amountUsdc,
        txHash: dto.txHash,
        status: EscrowStatus.HELD,
        events: {
          create: { action: 'HOLD', note: 'Funds placed in escrow' },
        },
      },
      include: { events: true },
    });
  }

  private async requireEscrow(id: string) {
    const escrow = await this.prisma.escrow.findUnique({ where: { id } });
    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }
    return escrow;
  }

  /** Release held funds to the artist. */
  async release(actorId: string, id: string, note?: string, txHash?: string) {
    const escrow = await this.requireEscrow(id);
    if (
      escrow.status !== EscrowStatus.HELD &&
      escrow.status !== EscrowStatus.DISPUTED
    ) {
      throw new BadRequestException(
        `Cannot release escrow in ${escrow.status}`,
      );
    }
    return this.prisma.escrow.update({
      where: { id },
      data: {
        status: EscrowStatus.RELEASED,
        releasedAt: new Date(),
        ...(txHash && { txHash }),
        events: {
          create: { action: 'RELEASE', note, actorId },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /** Refund held funds back to the client. */
  async refund(actorId: string, id: string, note?: string, txHash?: string) {
    const escrow = await this.requireEscrow(id);
    if (
      escrow.status !== EscrowStatus.HELD &&
      escrow.status !== EscrowStatus.DISPUTED
    ) {
      throw new BadRequestException(`Cannot refund escrow in ${escrow.status}`);
    }
    return this.prisma.escrow.update({
      where: { id },
      data: {
        status: EscrowStatus.REFUNDED,
        refundedAt: new Date(),
        ...(txHash && { txHash }),
        events: {
          create: { action: 'REFUND', note, actorId },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /** Freeze escrow while a dispute is open. */
  async disputeHold(actorId: string, id: string, note?: string) {
    const escrow = await this.requireEscrow(id);
    if (escrow.status !== EscrowStatus.HELD) {
      throw new BadRequestException(
        'Only held escrow can be put on dispute hold',
      );
    }
    return this.prisma.escrow.update({
      where: { id },
      data: {
        status: EscrowStatus.DISPUTED,
        events: {
          create: { action: 'DISPUTE_HOLD', note, actorId },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async findOne(userId: string, isAdmin: boolean, id: string) {
    const escrow = await this.prisma.escrow.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }
    if (!isAdmin && !(await this.isParty(escrow.commissionId, userId))) {
      throw new ForbiddenException('Not allowed to view this escrow');
    }
    return escrow;
  }

  async listForCommission(
    userId: string,
    isAdmin: boolean,
    commissionId: string,
  ) {
    if (!isAdmin && !(await this.isParty(commissionId, userId))) {
      throw new ForbiddenException('Not a party to this commission');
    }
    return this.prisma.escrow.findMany({
      where: { commissionId },
      orderBy: { createdAt: 'desc' },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /** Immutable audit trail for an escrow holding. */
  async auditTrail(userId: string, isAdmin: boolean, id: string) {
    const escrow = await this.findOne(userId, isAdmin, id);
    return escrow.events;
  }
}
