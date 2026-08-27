import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceCategoriesService } from './service-categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ServiceCategoriesService', () => {
  let service: ServiceCategoriesService;

  const mockPrisma = {
    serviceCategory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    service: { groupBy: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceCategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ServiceCategoriesService>(ServiceCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects a duplicate slug', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      service.create({ name: 'Design', slug: 'design' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing parent category', async () => {
    mockPrisma.serviceCategory.findUnique
      .mockResolvedValueOnce(null) // slug check
      .mockResolvedValueOnce(null); // parent check
    await expect(
      service.create({ name: 'Sub', slug: 'sub', parentId: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a top-level category', async () => {
    mockPrisma.serviceCategory.findUnique.mockResolvedValue(null);
    mockPrisma.serviceCategory.create.mockResolvedValue({ id: 'c1' });
    await service.create({ name: 'Design', slug: 'design', tags: ['ui'] });
    expect(mockPrisma.serviceCategory.create).toHaveBeenCalled();
  });

  it('maps trending categories to service counts', async () => {
    mockPrisma.service.groupBy.mockResolvedValue([
      { categoryId: 'c1', _count: 5 },
    ]);
    mockPrisma.serviceCategory.findMany.mockResolvedValue([
      { id: 'c1', name: 'Design' },
    ]);
    const res = await service.trending();
    expect(res).toEqual([
      { category: { id: 'c1', name: 'Design' }, serviceCount: 5 },
    ]);
  });
});
