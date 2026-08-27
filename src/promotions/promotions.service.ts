import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PromotionTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto } from './dto/promotion.dto';

const TIER_WEIGHT: Record<PromotionTier, number> = {
  SPOTLIGHT: 3,
  PREMIUM: 2,
  STANDARD: 1,
};

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromotionDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    return this.prisma.promotion.create({
      data: {
        serviceId: dto.serviceId,
        tier: dto.tier ?? PromotionTier.STANDARD,
        startsAt,
        endsAt,
        amountPaidUsdc: dto.amountPaidUsdc ?? 0,
      },
    });
  }

  /** Currently-featured services: active promotions within their window,
   *  ordered by tier weight then recency. */
  async listFeatured(now: Date = new Date()) {
    const promotions = await this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: { service: true },
    });
    return promotions
      .sort(
        (a, b) =>
          TIER_WEIGHT[b.tier] - TIER_WEIGHT[a.tier] ||
          b.startsAt.getTime() - a.startsAt.getTime(),
      )
      .map((p) => ({
        promotionId: p.id,
        tier: p.tier,
        endsAt: p.endsAt,
        service: p.service,
      }));
  }

  async list() {
    return this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async deactivate(id: string) {
    const promotion = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }
    return this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async analytics(now: Date = new Date()) {
    const [total, active, byTier] = await this.prisma.$transaction([
      this.prisma.promotion.count(),
      this.prisma.promotion.count({
        where: {
          isActive: true,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
      }),
      this.prisma.promotion.groupBy({
        by: ['tier'],
        _count: true,
        orderBy: { _count: { tier: 'desc' } },
      }),
    ]);
    return {
      total,
      active,
      byTier: byTier.map((t) => ({ tier: t.tier, count: t._count })),
    };
  }
}
