import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommissionStatus } from '@prisma/client';
import { CommissionRequestsService } from './commission-requests.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CommissionRequestsService', () => {
  let service: CommissionRequestsService;

  const mockPrisma = {
    artist: { findUnique: jest.fn() },
    commission: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    commissionRevision: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    commissionChecklistItem: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const parties = {
    id: 'c1',
    clientId: 'client-user',
    artist: { userId: 'artist-user' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionRequestsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CommissionRequestsService>(CommissionRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects a request with a past deadline', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue({ id: 'a1' });
    await expect(
      service.submitRequest('client-user', {
        artistId: 'a1',
        title: 't',
        description: 'd',
        budgetUsdc: '100',
        deadline: '2000-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets REVISION_REQUESTED when the client requests a revision', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue(parties);
    mockPrisma.commissionRevision.create.mockResolvedValue({ id: 'rev1' });
    await service.requestRevision('client-user', 'c1', 'please fix colors');
    expect(mockPrisma.commission.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: CommissionStatus.REVISION_REQUESTED },
    });
  });

  it('forbids a non-client from requesting a revision', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue(parties);
    await expect(
      service.requestRevision('artist-user', 'c1', 'x'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks verifying delivery before the work is delivered', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue({
      ...parties,
      deliveredAt: null,
    });
    await expect(
      service.verifyDelivery('client-user', 'c1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completes the commission when the client verifies delivery', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue({
      ...parties,
      deliveredAt: new Date(),
    });
    await service.verifyDelivery('client-user', 'c1');
    const dataMatcher: unknown = expect.objectContaining({
      status: CommissionStatus.COMPLETED,
    });
    expect(mockPrisma.commission.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: dataMatcher }),
    );
  });
});
