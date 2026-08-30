import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CachingService } from '../caching/caching.service';

@Injectable()
export class ServiceCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cachingService: CachingService,
  ) {}

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.serviceCategory.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException('A category with this slug already exists');
    }
    if (dto.parentId) {
      const parent = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }
    const category = await this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        tags: dto.tags ?? [],
        parentId: dto.parentId,
      },
    });
    await this.cachingService.del('categories:tree');
    return category;
  }

  /** Full category tree (top-level categories with nested children). */
  async tree() {
    const cachedTree = await this.cachingService.get('categories:tree');
    if (cachedTree) {
      return cachedTree;
    }

    const tree = await this.prisma.serviceCategory.findMany({
      where: { parentId: null },
      include: { children: true },
      orderBy: { name: 'asc' },
    });

    await this.cachingService.set('categories:tree', tree, 3600); // Cache for 1 hour
    return tree;
  }

  async findBySlug(slug: string) {
    const cacheKey = `category:${slug}`;
    const cachedCategory = await this.cachingService.get(cacheKey);
    if (cachedCategory) {
      return cachedCategory;
    }

    const category = await this.prisma.serviceCategory.findUnique({
      where: { slug },
      include: { children: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.cachingService.set(cacheKey, category, 3600); // Cache for 1 hour
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.requireCategory(id);
    const updatedCategory = await this.prisma.serviceCategory.update({
      where: { id },
      data: { ...dto },
    });

    await this.cachingService.del('categories:tree');
    await this.cachingService.del(`category:${updatedCategory.slug}`);
    return updatedCategory;
  }

  async remove(id: string) {
    const category = await this.requireCategory(id);
    await this.prisma.serviceCategory.delete({ where: { id } });

    await this.cachingService.del('categories:tree');
    await this.cachingService.del(`category:${category.slug}`);
    return { deleted: true };
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  /** Browse active services within a category (and its subcategories). */
  async browse(slug: string, page = 1, limit = 20) {
    const category = await this.findBySlug(slug);
    const ids = [category.id, ...category.children.map((c) => c.id)];
    const where = { isActive: true, categoryId: { in: ids } };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Trending categories ranked by number of active services. */
  async trending() {
    const grouped = await this.prisma.service.groupBy({
      by: ['categoryId'],
      where: { isActive: true, categoryId: { not: null } },
      _count: true,
      orderBy: { _count: { categoryId: 'desc' } },
      take: 10,
    });
    const categoryIds = grouped
      .map((g) => g.categoryId)
      .filter((id): id is string => id !== null);
    const categories = await this.prisma.serviceCategory.findMany({
      where: { id: { in: categoryIds } },
    });
    const byId = new Map(categories.map((c) => [c.id, c]));
    return grouped.map((g) => ({
      category: g.categoryId ? byId.get(g.categoryId) : null,
      serviceCount: g._count,
    }));
  }

  async analytics() {
    const [totalCategories, totalWithParent] = await this.prisma.$transaction([
      this.prisma.serviceCategory.count(),
      this.prisma.serviceCategory.count({ where: { parentId: { not: null } } }),
    ]);
    return {
      totalCategories,
      topLevel: totalCategories - totalWithParent,
      subcategories: totalWithParent,
    };
  }
}
