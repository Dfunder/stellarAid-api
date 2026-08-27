import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommissionStatus } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const mockPrisma = {
    commission: { findUnique: jest.fn() },
    review: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    reviewHelpfulVote: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    artist: { update: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { _all: 2 },
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ReviewsService>(ReviewsService);
  });

  const dto = { commissionId: 'c1', rating: 5, comment: 'great' };

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects reviews from a non-client of the commission', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue({
      id: 'c1',
      clientId: 'other',
      artistId: 'a1',
      status: CommissionStatus.COMPLETED,
      review: null,
    });
    await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects reviews on non-completed commissions', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue({
      id: 'c1',
      clientId: 'user-1',
      artistId: 'a1',
      status: CommissionStatus.IN_PROGRESS,
      review: null,
    });
    await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates a review and recomputes the artist rating', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue({
      id: 'c1',
      clientId: 'user-1',
      artistId: 'a1',
      status: CommissionStatus.COMPLETED,
      review: null,
    });
    mockPrisma.review.create.mockResolvedValue({ id: 'r1' });
    await service.create('user-1', dto);
    expect(mockPrisma.review.create).toHaveBeenCalled();
    expect(mockPrisma.artist.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1' },
        data: { averageRating: 4.5, totalReviews: 2 },
      }),
    );
  });

  it('toggles a helpful vote off when it already exists', async () => {
    mockPrisma.review.findUnique.mockResolvedValue({
      id: 'r1',
      artistId: 'a1',
    });
    mockPrisma.reviewHelpfulVote.findUnique.mockResolvedValue({ id: 'v1' });
    const res = await service.toggleHelpful('user-1', 'r1');
    expect(res).toEqual({ helpful: false });
    expect(mockPrisma.reviewHelpfulVote.delete).toHaveBeenCalled();
  });

  it('throws NotFound for a missing review', async () => {
    mockPrisma.review.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
