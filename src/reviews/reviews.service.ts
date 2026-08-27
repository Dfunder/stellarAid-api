import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a review. Verifies the commission is COMPLETED and that the
   * authenticated user is the client who commissioned it, enforcing the
   * "user completed commission" rule and the 1:1 review-per-commission
   * constraint.
   */
  async create(userId: string, dto: CreateReviewDto) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: dto.commissionId },
      include: { review: true },
    });
    if (!commission) {
      throw new NotFoundException('Commission not found');
    }
    if (commission.clientId !== userId) {
      throw new ForbiddenException('Only the commissioning client may review');
    }
    if (commission.status !== CommissionStatus.COMPLETED) {
      throw new BadRequestException(
        'Only completed commissions can be reviewed',
      );
    }
    if (commission.review) {
      throw new BadRequestException('This commission already has a review');
    }

    const review = await this.prisma.review.create({
      data: {
        commissionId: commission.id,
        reviewerId: userId,
        artistId: commission.artistId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
    await this.recomputeArtistRating(commission.artistId);
    return review;
  }

  async findAll(query: QueryReviewDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ReviewWhereInput = { isPublic: true };
    if (query.artistId) where.artistId = query.artistId;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { [query.sortBy ?? 'createdAt']: query.order ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async update(userId: string, id: string, rating?: number, comment?: string) {
    const review = await this.findOne(id);
    if (review.reviewerId !== userId) {
      throw new ForbiddenException('You can only edit your own review');
    }
    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        ...(rating !== undefined && { rating }),
        ...(comment !== undefined && { comment }),
      },
    });
    await this.recomputeArtistRating(review.artistId);
    return updated;
  }

  async remove(userId: string, id: string, isAdmin: boolean) {
    const review = await this.findOne(id);
    if (review.reviewerId !== userId && !isAdmin) {
      throw new ForbiddenException('Not allowed to delete this review');
    }
    await this.prisma.reviewHelpfulVote.deleteMany({ where: { reviewId: id } });
    await this.prisma.review.delete({ where: { id } });
    await this.recomputeArtistRating(review.artistId);
    return { deleted: true };
  }

  /** Admin moderation: toggle a review's public visibility. */
  async moderate(id: string, isPublic: boolean) {
    const review = await this.findOne(id);
    const updated = await this.prisma.review.update({
      where: { id },
      data: { isPublic },
    });
    await this.recomputeArtistRating(review.artistId);
    return updated;
  }

  /** Toggle a helpful vote for the given user; keeps helpfulCount in sync. */
  async toggleHelpful(userId: string, id: string) {
    await this.findOne(id);
    const existing = await this.prisma.reviewHelpfulVote.findUnique({
      where: { reviewId_userId: { reviewId: id, userId } },
    });
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.reviewHelpfulVote.delete({ where: { id: existing.id } }),
        this.prisma.review.update({
          where: { id },
          data: { helpfulCount: { decrement: 1 } },
        }),
      ]);
      return { helpful: false };
    }
    await this.prisma.$transaction([
      this.prisma.reviewHelpfulVote.create({ data: { reviewId: id, userId } }),
      this.prisma.review.update({
        where: { id },
        data: { helpfulCount: { increment: 1 } },
      }),
    ]);
    return { helpful: true };
  }

  /** Recompute an artist's cached averageRating / totalReviews over public reviews. */
  private async recomputeArtistRating(artistId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { artistId, isPublic: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.artist.update({
      where: { id: artistId },
      data: {
        averageRating: agg._avg.rating ?? 0,
        totalReviews: agg._count._all,
      },
    });
  }
}
