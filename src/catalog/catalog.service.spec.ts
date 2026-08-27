import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CatalogService', () => {
  let service: CatalogService;

  const mockPrisma = {
    service: { findMany: jest.fn(), count: jest.fn() },
    searchQuery: {
      create: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    savedSearch: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CatalogService>(CatalogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('records a search-analytics row when a query term is present', async () => {
    mockPrisma.service.count.mockResolvedValue(2);
    mockPrisma.service.findMany.mockResolvedValue([]);
    await service.searchServices(
      { q: 'Logo Design', page: 1, limit: 20 },
      'u1',
    );
    expect(mockPrisma.searchQuery.create).toHaveBeenCalledWith({
      data: { term: 'logo design', userId: 'u1', resultCount: 2 },
    });
  });

  it('does not record analytics for an empty query', async () => {
    mockPrisma.service.count.mockResolvedValue(0);
    mockPrisma.service.findMany.mockResolvedValue([]);
    await service.searchServices({ page: 1, limit: 20 });
    expect(mockPrisma.searchQuery.create).not.toHaveBeenCalled();
  });

  it('returns deduplicated autocomplete suggestions', async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      { title: 'Logo Design', category: 'design' },
      { title: 'Logo Design', category: 'branding' },
    ]);
    const res = await service.suggestions('logo');
    expect(res.suggestions).toEqual(['Logo Design']);
  });

  it('throws when running a saved search that is not yours', async () => {
    mockPrisma.savedSearch.findUnique.mockResolvedValue({
      id: 's1',
      userId: 'someone-else',
    });
    await expect(service.runSavedSearch('u1', 's1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
