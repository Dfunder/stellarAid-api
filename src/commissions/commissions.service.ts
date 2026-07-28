import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RejectCommissionDto } from './dto/accept-reject.dto';
import {
  RequestRevisionDto,
  SubmitCommissionDto,
} from './dto/submit-revision.dto';
import { CreateMilestonesDto } from './dto/milestone.dto';

const VALID_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  PENDING: [CommissionStatus.ACCEPTED, CommissionStatus.REJECTED, CommissionStatus.CANCELLED],
  ACCEPTED: [CommissionStatus.IN_PROGRESS, CommissionStatus.CANCELLED],
  REJECTED: [],
  IN_PROGRESS: [CommissionStatus.SUBMITTED, CommissionStatus.CANCELLED, CommissionStatus.DISPUTED],
  SUBMITTED: [CommissionStatus.COMPLETED, CommissionStatus.REVISION_REQUESTED],
  REVISION_REQUESTED: [CommissionStatus.SUBMITTED, CommissionStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: [],
};

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateTransition(current: CommissionStatus, next: CommissionStatus) {
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed || !allowed.includes(next)) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${next}`,
      );
    }
  }

  async accept(commissionId: string, artistId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
      include: { client: true },
    });

    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.artistId !== artistId) {
      throw new BadRequestException('Only the assigned artist can accept');
    }

    this.validateTransition(commission.status, CommissionStatus.ACCEPTED);

    const [updated] = await this.prisma.$transaction([
      this.prisma.commission.update({
        where: { id: commissionId },
        data: { status: CommissionStatus.ACCEPTED },
      }),
      this.prisma.conversation.create({
        data: {
          commissionId,
          participantIds: [commission.clientId, artistId],
        },
      }),
      this.prisma.notification.create({
        data: {
          userId: commission.clientId,
          type: 'COMMISSION_ACCEPTED',
          title: 'Commission Accepted',
          message: `Your commission "${commission.title}" has been accepted by the artist.`,
          metadata: { commissionId },
        },
      }),
    ]);

    return updated;
  }

  async reject(commissionId: string, artistId: string, dto: RejectCommissionDto) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });

    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.artistId !== artistId) {
      throw new BadRequestException('Only the assigned artist can reject');
    }

    this.validateTransition(commission.status, CommissionStatus.REJECTED);

    const [updated] = await this.prisma.$transaction([
      this.prisma.commission.update({
        where: { id: commissionId },
        data: { status: CommissionStatus.REJECTED },
      }),
      this.prisma.notification.create({
        data: {
          userId: commission.clientId,
          type: 'COMMISSION_REJECTED',
          title: 'Commission Rejected',
          message: dto.reason
            ? `Your commission "${commission.title}" was rejected: ${dto.reason}`
            : `Your commission "${commission.title}" was rejected.`,
          metadata: { commissionId, reason: dto.reason },
        },
      }),
    ]);

    return updated;
  }

  async submit(commissionId: string, artistId: string, dto: SubmitCommissionDto) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });

    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.artistId !== artistId) {
      throw new BadRequestException('Only the assigned artist can submit');
    }

    this.validateTransition(commission.status, CommissionStatus.SUBMITTED);

    return this.prisma.commission.update({
      where: { id: commissionId },
      data: {
        status: CommissionStatus.SUBMITTED,
        attachments: dto.deliverableUrls,
      },
    });
  }

  async requestRevision(commissionId: string, clientId: string, dto: RequestRevisionDto) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });

    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.clientId !== clientId) {
      throw new BadRequestException('Only the client can request revisions');
    }

    this.validateTransition(commission.status, CommissionStatus.REVISION_REQUESTED);

    return this.prisma.commission.update({
      where: { id: commissionId },
      data: { status: CommissionStatus.REVISION_REQUESTED },
    });
  }

  async approve(commissionId: string, clientId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });

    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.clientId !== clientId) {
      throw new BadRequestException('Only the client can approve');
    }

    this.validateTransition(commission.status, CommissionStatus.COMPLETED);

    return this.prisma.commission.update({
      where: { id: commissionId },
      data: { status: CommissionStatus.COMPLETED },
    });
  }

  async cancel(commissionId: string, userId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
      include: { payments: true },
    });

    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.clientId !== userId && commission.artistId !== userId) {
      throw new BadRequestException('Only participants can cancel');
    }

    this.validateTransition(commission.status, CommissionStatus.CANCELLED);

    const hasEscrow = commission.payments.some(
      (p) => p.status === 'CONFIRMED' || p.status === 'RELEASED',
    );

    const newStatus =
      commission.status === CommissionStatus.IN_PROGRESS && hasEscrow
        ? CommissionStatus.DISPUTED
        : CommissionStatus.CANCELLED;

    const [updated] = await this.prisma.$transaction([
      this.prisma.commission.update({
        where: { id: commissionId },
        data: { status: newStatus },
      }),
      this.prisma.notification.create({
        data: {
          userId: commission.clientId === userId ? commission.artistId : commission.clientId,
          type: newStatus === CommissionStatus.DISPUTED ? 'COMMISSION_DISPUTED' : 'COMMISSION_CANCELLED',
          title: newStatus === CommissionStatus.DISPUTED ? 'Commission Disputed' : 'Commission Cancelled',
          message: `Commission "${commission.title}" has been ${newStatus.toLowerCase()}.`,
          metadata: { commissionId },
        },
      }),
    ]);

    return updated;
  }

  async createMilestones(commissionId: string, artistId: string, dto: CreateMilestonesDto) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
      include: { milestones: true },
    });

    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.artistId !== artistId) {
      throw new BadRequestException('Only the assigned artist can create milestones');
    }
    if (commission.status !== CommissionStatus.IN_PROGRESS) {
      throw new BadRequestException('Milestones can only be created for in-progress commissions');
    }

    const existingTotal = commission.milestones.reduce(
      (sum, m) => sum + Number(m.amountUsdc),
      0,
    );
    const newTotal = dto.milestones.reduce((sum, m) => sum + m.amountUsdc, 0);

    if (existingTotal + newTotal > Number(commission.budgetUsdc)) {
      throw new BadRequestException(
        `Milestone total (${existingTotal + newTotal}) exceeds commission budget (${commission.budgetUsdc})`,
      );
    }

    return this.prisma.milestone.createMany({
      data: dto.milestones.map((m) => ({
        commissionId,
        title: m.title,
        description: m.description,
        amountUsdc: m.amountUsdc,
        dueDate: new Date(m.dueDate),
      })),
    });
  }

  async listMilestones(commissionId: string) {
    return this.prisma.milestone.findMany({
      where: { commissionId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async approveMilestone(commissionId: string, milestoneId: string, clientId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });

    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.clientId !== clientId) {
      throw new BadRequestException('Only the client can approve milestones');
    }

    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone || milestone.commissionId !== commissionId) {
      throw new NotFoundException('Milestone not found in this commission');
    }

    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: 'APPROVED', completedAt: new Date() },
    });
  }
}
