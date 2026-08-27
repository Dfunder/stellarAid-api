import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FavoritesService', () => {
  let service: FavoritesService;

  const mockPrisma = {
    service: { findUnique: jest.fn() },
    favorite: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    notification: { create: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<FavoritesService>(FavoritesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('captures the current price when favouriting', async () => {
    mockPrisma.service.findUnique.mockResolvedValue({
      id: 's1',
      priceUsdc: 50,
    });
    mockPrisma.favorite.upsert.mockResolvedValue({ id: 'f1' });
    await service.add('u1', 's1');
    expect(mockPrisma.favorite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: 'u1', serviceId: 's1', priceAtFavoriteUsdc: 50 },
      }),
    );
  });

  it('rejects favouriting a missing service', async () => {
    mockPrisma.service.findUnique.mockResolvedValue(null);
    await expect(service.add('u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('notifies on a price drop and reports it', async () => {
    mockPrisma.favorite.findMany.mockResolvedValue([
      {
        serviceId: 's1',
        priceAtFavoriteUsdc: 100,
        service: { id: 's1', title: 'Logo', priceUsdc: 80 },
      },
    ]);
    const res = await service.checkPriceDrops('u1');
    expect(res.drops).toEqual([{ serviceId: 's1', from: 100, to: 80 }]);
    const dataMatcher: unknown = expect.objectContaining({
      type: 'PRICE_DROP',
    });
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: dataMatcher }),
    );
  });

  it('does not notify when the price has not dropped', async () => {
    mockPrisma.favorite.findMany.mockResolvedValue([
      {
        serviceId: 's1',
        priceAtFavoriteUsdc: 100,
        service: { id: 's1', title: 'Logo', priceUsdc: 120 },
      },
    ]);
    const res = await service.checkPriceDrops('u1');
    expect(res.drops).toEqual([]);
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });
});
