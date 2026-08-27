import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { CreatePortfolioItemDto } from './dto/portfolio-item.dto';
import { QueryPortfolioDto } from './dto/query-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the Artist row that owns portfolios for a given auth user id. */
  private async requireArtistId(userId: string): Promise<string> {
    const artist = await this.prisma.artist.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!artist) {
      throw new ForbiddenException('Only artists can manage portfolios');
    }
    return artist.id;
  }

  private async requireOwnedPortfolio(id: string, artistId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({ where: { id } });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }
    if (portfolio.artistId !== artistId) {
      throw new ForbiddenException('You do not own this portfolio');
    }
    return portfolio;
  }

  async create(userId: string, dto: CreatePortfolioDto) {
    const artistId = await this.requireArtistId(userId);
    return this.prisma.portfolio.create({
      data: {
        artistId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        tags: dto.tags ?? [],
        coverImageUrl: dto.coverImageUrl,
      },
    });
  }

  async findAll(query: QueryPortfolioDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PortfolioWhereInput = {};

    if (query.category) where.category = query.category;
    if (query.tag) where.tags = { has: query.tag };
    // Public listings default to published-only unless caller explicitly asks.
    where.isPublished = query.isPublished ?? true;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.portfolio.count({ where }),
      this.prisma.portfolio.findMany({
        where,
        orderBy: { [query.sortBy ?? 'createdAt']: query.order ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { items: { orderBy: { order: 'asc' } } },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }
    return portfolio;
  }

  async update(userId: string, id: string, dto: UpdatePortfolioDto) {
    const artistId = await this.requireArtistId(userId);
    await this.requireOwnedPortfolio(id, artistId);
    return this.prisma.portfolio.update({ where: { id }, data: { ...dto } });
  }

  async remove(userId: string, id: string) {
    const artistId = await this.requireArtistId(userId);
    await this.requireOwnedPortfolio(id, artistId);
    await this.prisma.portfolioViewDay.deleteMany({
      where: { portfolioId: id },
    });
    await this.prisma.portfolioItem.deleteMany({ where: { portfolioId: id } });
    await this.prisma.portfolio.delete({ where: { id } });
    return { deleted: true };
  }

  /** Visibility control: publish or unpublish a portfolio. */
  async setVisibility(userId: string, id: string, isPublished: boolean) {
    const artistId = await this.requireArtistId(userId);
    await this.requireOwnedPortfolio(id, artistId);
    return this.prisma.portfolio.update({
      where: { id },
      data: { isPublished },
    });
  }

  async addItem(userId: string, id: string, dto: CreatePortfolioItemDto) {
    const artistId = await this.requireArtistId(userId);
    await this.requireOwnedPortfolio(id, artistId);
    const order =
      dto.order ??
      (await this.prisma.portfolioItem.count({ where: { portfolioId: id } }));
    return this.prisma.portfolioItem.create({
      data: {
        portfolioId: id,
        imageUrl: dto.imageUrl,
        title: dto.title,
        description: dto.description,
        order,
      },
    });
  }

  async removeItem(userId: string, id: string, itemId: string) {
    const artistId = await this.requireArtistId(userId);
    await this.requireOwnedPortfolio(id, artistId);
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.portfolioId !== id) {
      throw new NotFoundException('Portfolio item not found');
    }
    await this.prisma.portfolioItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  /** Records a view: increments lifetime count and the per-day analytics row. */
  async trackView(id: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await this.prisma.$transaction([
      this.prisma.portfolio.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }),
      this.prisma.portfolioViewDay.upsert({
        where: { portfolioId_date: { portfolioId: id, date: today } },
        create: { portfolioId: id, date: today, viewCount: 1 },
        update: { viewCount: { increment: 1 } },
      }),
    ]);
    return { tracked: true };
  }

  async getAnalytics(userId: string, id: string) {
    const artistId = await this.requireArtistId(userId);
    const portfolio = await this.requireOwnedPortfolio(id, artistId);
    const days = await this.prisma.portfolioViewDay.findMany({
      where: { portfolioId: id },
      orderBy: { date: 'desc' },
      take: 30,
    });
    return { totalViews: portfolio.viewCount, dailyViews: days };
  }
}
