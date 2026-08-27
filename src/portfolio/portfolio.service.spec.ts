import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PortfolioCategory } from '@prisma/client';
import { PortfolioService } from './portfolio.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PortfolioService', () => {
  let service: PortfolioService;

  const mockPrisma = {
    artist: { findUnique: jest.fn() },
    portfolio: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    portfolioItem: {
      create: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    portfolioViewDay: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<PortfolioService>(PortfolioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('rejects non-artist users', async () => {
      mockPrisma.artist.findUnique.mockResolvedValue(null);
      await expect(
        service.create('user-1', {
          title: 't',
          description: 'd',
          category: PortfolioCategory.ILLUSTRATION,
          coverImageUrl: 'https://x/y.png',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates a portfolio for an artist and defaults empty tags', async () => {
      mockPrisma.artist.findUnique.mockResolvedValue({ id: 'artist-1' });
      mockPrisma.portfolio.create.mockResolvedValue({ id: 'p1' });
      await service.create('user-1', {
        title: 't',
        description: 'd',
        category: PortfolioCategory.ILLUSTRATION,
        coverImageUrl: 'https://x/y.png',
      });
      const dataMatcher: unknown = expect.objectContaining({
        artistId: 'artist-1',
        tags: [],
      });
      expect(mockPrisma.portfolio.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: dataMatcher }),
      );
    });
  });

  describe('findOne', () => {
    it('throws when portfolio is missing', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('trackView', () => {
    it('increments lifetime count and upserts the daily row', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({ id: 'p1' });
      await service.trackView('p1');
      expect(mockPrisma.portfolio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { viewCount: { increment: 1 } },
        }),
      );
      expect(mockPrisma.portfolioViewDay.upsert).toHaveBeenCalled();
    });
  });

  describe('setVisibility', () => {
    it('forbids publishing a portfolio the artist does not own', async () => {
      mockPrisma.artist.findUnique.mockResolvedValue({ id: 'artist-1' });
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        artistId: 'other-artist',
      });
      await expect(
        service.setVisibility('user-1', 'p1', true),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
