import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommissionStatus,
  DisputeResolution,
  DisputeStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileDisputeDto, QueryDisputeDto } from './dto/dispute.dto';

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadParties(commissionId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
      include: { artist: { select: { userId: true } } },
    });
    if (!commission) {
      throw new NotFoundException('Commission not found');
    }
    return {
      commission,
      clientUserId: commission.clientId,
      artistUserId: commission.artist.userId,
    };
  }

  /** File a dispute against a commission the caller is a party to. */
  async file(userId: string, dto: FileDisputeDto) {
    const { commission, clientUserId, artistUserId } = await this.loadParties(
      dto.commissionId,
    );
    if (userId !== clientUserId && userId !== artistUserId) {
      throw new ForbiddenException(
        'Only a party to the commission may dispute',
      );
    }
    const againstId = userId === clientUserId ? artistUserId : clientUserId;

    const dispute = await this.prisma.dispute.create({
      data: {
        commissionId: commission.id,
        filedById: userId,
        againstId,
        reason: dto.reason,
        evidence: dto.evidence ?? [],
      },
    });
    await this.prisma.commission.update({
      where: { id: commission.id },
      data: { status: CommissionStatus.DISPUTED },
    });
    return dispute;
  }

  private async requireDispute(id: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }
    return dispute;
  }

  async addEvidence(userId: string, id: string, evidence: string[]) {
    const dispute = await this.requireDispute(id);
    if (dispute.filedById !== userId && dispute.againstId !== userId) {
      throw new ForbiddenException('Not a party to this dispute');
    }
    if (
      dispute.status !== DisputeStatus.OPEN &&
      dispute.status !== DisputeStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException('Evidence can only be added while active');
    }
    return this.prisma.dispute.update({
      where: { id },
      data: { evidence: { push: evidence } },
    });
  }

  async list(userId: string, isAdmin: boolean, query: QueryDisputeDto) {
    const where: Prisma.DisputeWhereInput = {};
    if (query.status) where.status = query.status;
    if (!isAdmin) {
      where.OR = [{ filedById: userId }, { againstId: userId }];
    }
    return this.prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, isAdmin: boolean, id: string) {
    const dispute = await this.requireDispute(id);
    if (
      !isAdmin &&
      dispute.filedById !== userId &&
      dispute.againstId !== userId
    ) {
      throw new ForbiddenException('Not allowed to view this dispute');
    }
    return dispute;
  }

  /** Admin marks a dispute as being actively reviewed. */
  async review(adminId: string, id: string) {
    const dispute = await this.requireDispute(id);
    if (
      dispute.status !== DisputeStatus.OPEN &&
      dispute.status !== DisputeStatus.APPEALED
    ) {
      throw new BadRequestException(
        'Only open or appealed disputes can enter review',
      );
    }
    return this.prisma.dispute.update({
      where: { id },
      data: { status: DisputeStatus.UNDER_REVIEW, reviewedById: adminId },
    });
  }

  /** Admin resolves a dispute and cascades the outcome to the commission. */
  async resolve(
    adminId: string,
    id: string,
    resolution: DisputeResolution,
    note?: string,
  ) {
    const dispute = await this.requireDispute(id);
    if (
      dispute.status === DisputeStatus.RESOLVED ||
      dispute.status === DisputeStatus.CLOSED
    ) {
      throw new BadRequestException('Dispute is already finalised');
    }
    const updated = await this.prisma.dispute.update({
      where: { id },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution,
        resolutionNote: note,
        reviewedById: adminId,
        resolvedAt: new Date(),
      },
    });
    const commissionStatus =
      resolution === DisputeResolution.REFUND_CLIENT
        ? CommissionStatus.CANCELLED
        : CommissionStatus.COMPLETED;
    await this.prisma.commission.update({
      where: { id: dispute.commissionId },
      data: { status: commissionStatus },
    });
    return updated;
  }

  async reject(adminId: string, id: string, note?: string) {
    await this.requireDispute(id);
    return this.prisma.dispute.update({
      where: { id },
      data: {
        status: DisputeStatus.REJECTED,
        reviewedById: adminId,
        resolutionNote: note,
        resolvedAt: new Date(),
      },
    });
  }

  /** A party may appeal a resolved/rejected dispute, reopening it for review. */
  async appeal(userId: string, id: string, note: string) {
    const dispute = await this.requireDispute(id);
    if (dispute.filedById !== userId && dispute.againstId !== userId) {
      throw new ForbiddenException('Not a party to this dispute');
    }
    if (
      dispute.status !== DisputeStatus.RESOLVED &&
      dispute.status !== DisputeStatus.REJECTED
    ) {
      throw new BadRequestException('Only resolved disputes can be appealed');
    }
    return this.prisma.dispute.update({
      where: { id },
      data: {
        status: DisputeStatus.APPEALED,
        appealNote: note,
        appealedAt: new Date(),
      },
    });
  }

  /**
   * Auto-resolve disputes left OPEN past the timeout window with a neutral SPLIT
   * outcome. Intended to be invoked by a scheduled job.
   */
  async autoResolveTimeouts(timeoutDays = 14, now: Date = new Date()) {
    const cutoff = new Date(now.getTime() - timeoutDays * 24 * 60 * 60 * 1000);
    const stale = await this.prisma.dispute.findMany({
      where: { status: DisputeStatus.OPEN, createdAt: { lte: cutoff } },
      select: { id: true },
    });
    if (stale.length === 0) return { autoResolved: 0 };
    await this.prisma.dispute.updateMany({
      where: { id: { in: stale.map((d) => d.id) } },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution: DisputeResolution.SPLIT,
        resolutionNote: 'Auto-resolved after timeout',
        resolvedAt: now,
      },
    });
    return { autoResolved: stale.length };
  }
}
