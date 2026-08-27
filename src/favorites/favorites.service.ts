import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Add a service to the caller's favourites (idempotent per user+service). */
  async add(userId: string, serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, priceUsdc: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return this.prisma.favorite.upsert({
      where: { userId_serviceId: { userId, serviceId } },
      create: {
        userId,
        serviceId,
        priceAtFavoriteUsdc: service.priceUsdc,
      },
      update: {},
    });
  }

  async remove(userId: string, serviceId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_serviceId: { userId, serviceId } },
    });
    if (!existing) {
      throw new NotFoundException('Favourite not found');
    }
    await this.prisma.favorite.delete({
      where: { userId_serviceId: { userId, serviceId } },
    });
    return { removed: true };
  }

  async list(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { service: true },
    });
  }

  /** Public/shareable wishlist for a given user id. */
  async sharedList(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        service: {
          select: {
            id: true,
            title: true,
            category: true,
            priceUsdc: true,
          },
        },
      },
    });
  }

  /**
   * Detect price drops against the price captured when favourited and raise an
   * in-app notification for each drop.
   */
  async checkPriceDrops(userId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: {
        service: { select: { id: true, title: true, priceUsdc: true } },
      },
    });
    const drops: Array<{ serviceId: string; from: number; to: number }> = [];
    for (const fav of favorites) {
      const now = Number(fav.service.priceUsdc);
      const then = Number(fav.priceAtFavoriteUsdc);
      if (now < then) {
        drops.push({ serviceId: fav.serviceId, from: then, to: now });
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'PRICE_DROP',
            title: 'Price drop on a favourite',
            message: `${fav.service.title} dropped from ${then} to ${now} USDC`,
            metadata: { serviceId: fav.serviceId, from: then, to: now },
          },
        });
      }
    }
    return { drops };
  }

  /** Most-favourited services across the platform (admin analytics). */
  async analytics() {
    const grouped = await this.prisma.favorite.groupBy({
      by: ['serviceId'],
      _count: true,
      orderBy: { _count: { serviceId: 'desc' } },
      take: 20,
    });
    return {
      topServices: grouped.map((g) => ({
        serviceId: g.serviceId,
        favorites: g._count,
      })),
    };
  }
}
