import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommissionRevisionStatus, CommissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitCommissionRequestDto } from './dto/commission-request.dto';

@Injectable()
export class CommissionRequestsService {
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

  /** Submit a commission request with validation, delivery date, and checklist. */
  async submitRequest(clientUserId: string, dto: SubmitCommissionRequestDto) {
    const artist = await this.prisma.artist.findUnique({
      where: { id: dto.artistId },
      select: { id: true },
    });
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }
    const deadline = new Date(dto.deadline);
    if (deadline.getTime() <= Date.now()) {
      throw new BadRequestException('Deadline must be in the future');
    }

    return this.prisma.commission.create({
      data: {
        clientId: clientUserId,
        artistId: dto.artistId,
        serviceId: dto.serviceId,
        title: dto.title,
        description: dto.description,
        budgetUsdc: dto.budgetUsdc,
        deadline,
        deliveryDueAt: dto.deliveryDueAt ? new Date(dto.deliveryDueAt) : null,
        checklist: dto.checklist
          ? { create: dto.checklist.map((label) => ({ label })) }
          : undefined,
      },
      include: { checklist: true },
    });
  }

  // --- Revisions -----------------------------------------------------------

  async requestRevision(
    userId: string,
    commissionId: string,
    feedback: string,
  ) {
    const { commission, clientUserId } = await this.loadParties(commissionId);
    if (userId !== clientUserId) {
      throw new ForbiddenException('Only the client may request revisions');
    }
    const revision = await this.prisma.commissionRevision.create({
      data: { commissionId: commission.id, requestedById: userId, feedback },
    });
    await this.prisma.commission.update({
      where: { id: commission.id },
      data: { status: CommissionStatus.REVISION_REQUESTED },
    });
    return revision;
  }

  async markRevisionAddressed(userId: string, revisionId: string) {
    const revision = await this.prisma.commissionRevision.findUnique({
      where: { id: revisionId },
    });
    if (!revision) {
      throw new NotFoundException('Revision not found');
    }
    const { artistUserId } = await this.loadParties(revision.commissionId);
    if (userId !== artistUserId) {
      throw new ForbiddenException('Only the artist may address revisions');
    }
    return this.prisma.commissionRevision.update({
      where: { id: revisionId },
      data: { status: CommissionRevisionStatus.ADDRESSED },
    });
  }

  async listRevisions(userId: string, commissionId: string) {
    const { clientUserId, artistUserId } = await this.loadParties(commissionId);
    if (userId !== clientUserId && userId !== artistUserId) {
      throw new ForbiddenException('Not a party to this commission');
    }
    return this.prisma.commissionRevision.findMany({
      where: { commissionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Completion checklist ------------------------------------------------

  async addChecklistItem(userId: string, commissionId: string, label: string) {
    const { artistUserId } = await this.loadParties(commissionId);
    if (userId !== artistUserId) {
      throw new ForbiddenException('Only the artist manages the checklist');
    }
    return this.prisma.commissionChecklistItem.create({
      data: { commissionId, label },
    });
  }

  async toggleChecklistItem(userId: string, itemId: string, isDone: boolean) {
    const item = await this.prisma.commissionChecklistItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }
    const { artistUserId } = await this.loadParties(item.commissionId);
    if (userId !== artistUserId) {
      throw new ForbiddenException('Only the artist manages the checklist');
    }
    return this.prisma.commissionChecklistItem.update({
      where: { id: itemId },
      data: { isDone },
    });
  }

  async getChecklist(userId: string, commissionId: string) {
    const { clientUserId, artistUserId } = await this.loadParties(commissionId);
    if (userId !== clientUserId && userId !== artistUserId) {
      throw new ForbiddenException('Not a party to this commission');
    }
    return this.prisma.commissionChecklistItem.findMany({
      where: { commissionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // --- Delivery tracking & verification ------------------------------------

  async setDeliveryDate(userId: string, commissionId: string, date: string) {
    const { artistUserId } = await this.loadParties(commissionId);
    if (userId !== artistUserId) {
      throw new ForbiddenException('Only the artist sets the delivery date');
    }
    return this.prisma.commission.update({
      where: { id: commissionId },
      data: { deliveryDueAt: new Date(date) },
    });
  }

  /** Artist marks the work delivered. */
  async markDelivered(userId: string, commissionId: string) {
    const { commission, artistUserId } = await this.loadParties(commissionId);
    if (userId !== artistUserId) {
      throw new ForbiddenException('Only the artist can mark delivery');
    }
    return this.prisma.commission.update({
      where: { id: commission.id },
      data: { deliveredAt: new Date(), status: CommissionStatus.SUBMITTED },
    });
  }

  /** Client verifies delivery, completing the commission. */
  async verifyDelivery(userId: string, commissionId: string) {
    const { commission, clientUserId } = await this.loadParties(commissionId);
    if (userId !== clientUserId) {
      throw new ForbiddenException('Only the client can verify delivery');
    }
    if (!commission.deliveredAt) {
      throw new BadRequestException('Work has not been marked delivered yet');
    }
    return this.prisma.commission.update({
      where: { id: commission.id },
      data: {
        deliveryVerifiedAt: new Date(),
        status: CommissionStatus.COMPLETED,
      },
    });
  }
}
