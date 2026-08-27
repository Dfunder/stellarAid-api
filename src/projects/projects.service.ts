import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MilestoneStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone.dto';

@Injectable()
export class ProjectsService {
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
      commissionId: commission.id,
      clientUserId: commission.clientId,
      artistUserId: commission.artist.userId,
    };
  }

  private async milestoneParties(milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }
    const parties = await this.loadParties(milestone.commissionId);
    return { milestone, ...parties };
  }

  async create(userId: string, commissionId: string, dto: CreateMilestoneDto) {
    const { artistUserId } = await this.loadParties(commissionId);
    if (userId !== artistUserId) {
      throw new ForbiddenException('Only the artist can define milestones');
    }
    return this.prisma.milestone.create({
      data: {
        commissionId,
        title: dto.title,
        description: dto.description,
        amountUsdc: dto.amountUsdc,
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  async list(userId: string, commissionId: string) {
    const { clientUserId, artistUserId } = await this.loadParties(commissionId);
    if (userId !== clientUserId && userId !== artistUserId) {
      throw new ForbiddenException('Not a party to this commission');
    }
    return this.prisma.milestone.findMany({
      where: { commissionId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateMilestoneDto) {
    const { artistUserId } = await this.milestoneParties(id);
    if (userId !== artistUserId) {
      throw new ForbiddenException('Only the artist can edit milestones');
    }
    return this.prisma.milestone.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amountUsdc !== undefined && { amountUsdc: dto.amountUsdc }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const { artistUserId } = await this.milestoneParties(id);
    if (userId !== artistUserId) {
      throw new ForbiddenException('Only the artist can delete milestones');
    }
    await this.prisma.milestone.delete({ where: { id } });
    return { deleted: true };
  }

  /** Artist submits a milestone for client review. */
  async submit(userId: string, id: string) {
    const { milestone, artistUserId } = await this.milestoneParties(id);
    if (userId !== artistUserId) {
      throw new ForbiddenException('Only the artist can submit milestones');
    }
    return this.prisma.milestone.update({
      where: { id: milestone.id },
      data: { status: MilestoneStatus.SUBMITTED },
    });
  }

  /** Client verifies/approves a submitted milestone. */
  async approve(userId: string, id: string) {
    const { milestone, clientUserId } = await this.milestoneParties(id);
    if (userId !== clientUserId) {
      throw new ForbiddenException('Only the client can approve milestones');
    }
    if (milestone.status !== MilestoneStatus.SUBMITTED) {
      throw new BadRequestException(
        'Milestone must be submitted before approval',
      );
    }
    return this.prisma.milestone.update({
      where: { id: milestone.id },
      data: { status: MilestoneStatus.APPROVED, completedAt: new Date() },
    });
  }

  /** Release milestone-based payment (client) and notify the artist. */
  async releasePayment(userId: string, id: string) {
    const { milestone, clientUserId, artistUserId } =
      await this.milestoneParties(id);
    if (userId !== clientUserId) {
      throw new ForbiddenException('Only the client can release payment');
    }
    if (milestone.status !== MilestoneStatus.APPROVED) {
      throw new BadRequestException(
        'Milestone must be approved before payment',
      );
    }
    const updated = await this.prisma.milestone.update({
      where: { id: milestone.id },
      data: { status: MilestoneStatus.PAID },
    });
    await this.prisma.notification.create({
      data: {
        userId: artistUserId,
        type: 'MILESTONE_PAID',
        title: 'Milestone payment released',
        message: `Payment for "${milestone.title}" has been released`,
        metadata: { milestoneId: milestone.id },
      },
    });
    return updated;
  }

  /** Timeline/progress data for milestone visualization. */
  async progress(userId: string, commissionId: string) {
    const { clientUserId, artistUserId } = await this.loadParties(commissionId);
    if (userId !== clientUserId && userId !== artistUserId) {
      throw new ForbiddenException('Not a party to this commission');
    }
    const milestones = await this.prisma.milestone.findMany({
      where: { commissionId },
      orderBy: { dueDate: 'asc' },
    });
    const total = milestones.length;
    const completed = milestones.filter(
      (m) =>
        m.status === MilestoneStatus.APPROVED ||
        m.status === MilestoneStatus.PAID,
    ).length;
    const byStatus = milestones.reduce<Record<string, number>>((acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    }, {});
    return {
      total,
      completed,
      percentComplete: total === 0 ? 0 : Math.round((completed / total) * 100),
      byStatus,
      timeline: milestones.map((m) => ({
        id: m.id,
        title: m.title,
        dueDate: m.dueDate,
        status: m.status,
        completedAt: m.completedAt,
      })),
    };
  }
}
