import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

const FLUSH_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class PortfolioAnalyticsService
  implements OnModuleInit, OnModuleDestroy
{
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('RedisClient') private readonly redis: Redis,
  ) {}

  onModuleInit() {
    this.flushTimer = setInterval(() => {
      void this.flushPendingViews();
    }, FLUSH_INTERVAL_MS);
    this.flushTimer.unref();
  }

  async onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flushPendingViews();
  }

  async recordView(portfolioId: string, itemIds: string[]) {
    const date = this.dateKey(new Date());
    await Promise.all([
      this.redis.incr(`portfolio:views:pending:${portfolioId}`),
      this.redis.incr(`portfolio:views:daily:${portfolioId}:${date}`),
    ]);

    if (itemIds.length > 0) {
      await this.prisma.portfolioItem.updateMany({
        where: { id: { in: itemIds } },
        data: { viewCount: { increment: 1 } },
      });
    }
  }

  async getAnalytics(portfolioId: string, userId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { artist: { select: { userId: true } } },
    });

    if (!portfolio) throw new NotFoundException('Portfolio not found');
    if (portfolio.artist.userId !== userId) {
      throw new ForbiddenException('You can only view your own portfolio analytics');
    }

    const today = new Date();
    const start = new Date(today);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 6);
    const monthStart = new Date(today);
    monthStart.setUTCHours(0, 0, 0, 0);
    monthStart.setUTCDate(monthStart.getUTCDate() - 29);

    const [dailyRows, pendingTotal, pendingDaily, topItems] = await Promise.all([
      this.prisma.portfolioViewDay.findMany({
        where: { portfolioId, date: { gte: monthStart } },
      }),
      this.redis.get(`portfolio:views:pending:${portfolioId}`),
      this.getPendingDailyViews(portfolioId, monthStart),
      this.prisma.portfolioItem.findMany({
        where: { portfolioId },
        orderBy: [{ viewCount: 'desc' }, { order: 'asc' }],
        take: 10,
      }),
    ]);

    const pending = Number(pendingTotal ?? 0);
    const pendingByDate = new Map(pendingDaily);
    const getCount = (date: Date) => {
      const key = this.dateKey(date);
      const stored = dailyRows.find((row) => this.dateKey(row.date) === key);
      return (stored?.viewCount ?? 0) + (pendingByDate.get(key) ?? 0);
    };

    let viewsThisWeek = 0;
    let viewsThisMonth = 0;
    for (let offset = 0; offset < 30; offset += 1) {
      const date = new Date(today);
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - offset);
      const count = getCount(date);
      viewsThisMonth += count;
      if (offset < 7) viewsThisWeek += count;
    }

    return {
      totalViews: portfolio.viewCount + pending,
      viewsThisWeek,
      viewsThisMonth,
      topItems,
    };
  }

  private async flushPendingViews() {
    const keys = await this.redis.keys('portfolio:views:pending:*');
    for (const key of keys) {
      const portfolioId = key.slice('portfolio:views:pending:'.length);
      const count = Number(await this.redis.getset(key, '0'));
      if (!count) continue;

      const date = this.dateKey(new Date());
      try {
        await this.prisma.$transaction([
          this.prisma.portfolio.update({
            where: { id: portfolioId },
            data: { viewCount: { increment: count } },
          }),
          this.prisma.portfolioItem.updateMany({
            where: { portfolioId },
            data: { viewCount: { increment: count } },
          }),
          this.prisma.portfolioViewDay.upsert({
            where: { portfolioId_date: { portfolioId, date: this.dateValue(date) } },
            create: { portfolioId, date: this.dateValue(date), viewCount: count },
            update: { viewCount: { increment: count } },
          }),
        ]);
        await this.redis.set(`portfolio:views:daily:${portfolioId}:${date}`, '0');
      } catch (error) {
        await this.redis.incrby(key, count);
        throw error;
      }
    }
  }

  private async getPendingDailyViews(portfolioId: string, from: Date) {
    const keys = await this.redis.keys(`portfolio:views:daily:${portfolioId}:*`);
    const entries: Array<[string, number]> = [];
    for (const key of keys) {
      const date = key.slice(`portfolio:views:daily:${portfolioId}:`.length);
      if (new Date(`${date}T00:00:00.000Z`) < from) continue;
      entries.push([date, Number((await this.redis.get(key)) ?? 0)]);
    }
    return entries;
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private dateValue(date: string) {
    return new Date(`${date}T00:00:00.000Z`);
  }
}
