import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { CreateCommissionDto } from './dto/create-commission.dto';

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: { artist: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const where: Record<string, unknown> = {};

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
          include: { user: { select: { id: true, name: true } } },
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
      include: { artist: true },
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
