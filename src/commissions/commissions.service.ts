import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { CreateCommissionDto } from './dto/create-commission.dto';
import { SubmitCommissionDto } from './dto/submit-revision.dto';

const VALID_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  PENDING: [CommissionStatus.ACCEPTED],
  ACCEPTED: [CommissionStatus.SUBMITTED],
  REJECTED: [],
  IN_PROGRESS: [CommissionStatus.SUBMITTED],
  SUBMITTED: [CommissionStatus.COMPLETED],
  REVISION_REQUESTED: [CommissionStatus.SUBMITTED],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: [],
};

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateTransition(
    current: CommissionStatus,
    next: CommissionStatus,
  ) {
    if (!VALID_TRANSITIONS[current]?.includes(next)) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${next}`,
      );
    }
  }

  async accept(commissionId: string, artistId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
      include: { artist: true },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.artist.userId !== artistId)
      throw new BadRequestException('Only the assigned artist can accept');
    this.validateTransition(commission.status, CommissionStatus.ACCEPTED);
    return this.prisma.commission.update({
      where: { id: commissionId },
      data: { status: CommissionStatus.ACCEPTED },
    });
  }

  async submit(
    commissionId: string,
    artistId: string,
    dto: SubmitCommissionDto,
  ) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
      include: { artist: true },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.artist.userId !== artistId)
      throw new BadRequestException('Only the assigned artist can submit');
    this.validateTransition(commission.status, CommissionStatus.SUBMITTED);
    return this.prisma.commission.update({
      where: { id: commissionId },
      data: {
        status: CommissionStatus.SUBMITTED,
        attachments: dto.deliverableUrls,
      },
    });
  }

  async approve(commissionId: string, clientId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId },
    });
    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.clientId !== clientId)
      throw new BadRequestException('Only the client can approve');
    this.validateTransition(commission.status, CommissionStatus.COMPLETED);
    return this.prisma.commission.update({
      where: { id: commissionId },
      data: { status: CommissionStatus.COMPLETED },
    });
  }

  async create(clientUserId: string, dto: CreateCommissionDto) {
    const artist = await this.prisma.artist.findUnique({
      where: { userId: dto.artistUserId },
    });

    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: dto.serviceId },
      });

      if (!service || service.artistId !== artist.id) {
        throw new NotFoundException('Service not found for this artist');
      }
    }

    const commission = await this.prisma.commission.create({
      data: {
        clientId: clientUserId,
        artistId: artist.id,
        serviceId: dto.serviceId ?? null,
        title: dto.title,
        description: dto.description,
        budgetUsdc: dto.budgetUsdc,
        deadline: new Date(dto.deadline),
        attachments: dto.attachments ?? [],
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        artist: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        service: true,
      },
    });

    return commission;
  }

  async findAllForUser(
    userId: string,
    page?: number | string,
    limit?: number | string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, artist: { select: { id: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const where: Prisma.CommissionWhereInput = {};

    if (user.role === 'ARTIST' && user.artist) {
      where.artistId = user.artist.id;
    } else {
      where.clientId = userId;
    }

    return paginate({
      page,
      limit,
      fetch: ({ skip, take }) =>
        this.prisma.commission.findMany({
          where,
          skip,
          take,
          include: {
            client: { select: { id: true, name: true } },
            artist: {
              include: { user: { select: { id: true, name: true } } },
            },
            service: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      count: () => this.prisma.commission.count({ where }),
    });
  }

  async findOne(id: string, userId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        artist: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        service: true,
        milestones: true,
        review: true,
      },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        artist: { select: { id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isClient = commission.clientId === userId;
    const isArtist =
      user.artist !== null && commission.artistId === user.artist.id;

    if (!isClient && !isArtist) {
      throw new ForbiddenException(
        'You are not a participant of this commission',
      );
    }

    return commission;
  }
}
