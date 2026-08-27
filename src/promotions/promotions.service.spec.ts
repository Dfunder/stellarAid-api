import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PromotionTier } from '@prisma/client';
import { PromotionsService } from './promotions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PromotionsService', () => {
  let service: PromotionsService;

  const mockPrisma = {
    service: { findUnique: jest.fn() },
    promotion: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<PromotionsService>(PromotionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects a promotion for a missing service', async () => {
    mockPrisma.service.findUnique.mockResolvedValue(null);
    await expect(
      service.create({
        serviceId: 'missing',
        startsAt: '2030-01-01',
        endsAt: '2030-02-01',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an inverted promotion window', async () => {
    mockPrisma.service.findUnique.mockResolvedValue({ id: 's1' });
    await expect(
      service.create({
        serviceId: 's1',
        startsAt: '2030-02-01',
        endsAt: '2030-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('orders featured services by tier weight', async () => {
    mockPrisma.promotion.findMany.mockResolvedValue([
      {
        id: 'p1',
        tier: PromotionTier.STANDARD,
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2027-01-01'),
        service: { id: 's1' },
      },
      {
        id: 'p2',
        tier: PromotionTier.SPOTLIGHT,
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2027-01-01'),
        service: { id: 's2' },
      },
    ]);
    const res = await service.listFeatured(new Date('2026-06-01'));
    expect(res[0].promotionId).toBe('p2');
    expect(res[1].promotionId).toBe('p1');
  });
});
