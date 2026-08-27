import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
  CommissionStatus,
  DisputeResolution,
  DisputeStatus,
} from '@prisma/client';
import { DisputesService } from './disputes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DisputesService', () => {
  let service: DisputesService;

  const mockPrisma = {
    commission: { findUnique: jest.fn(), update: jest.fn() },
    dispute: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<DisputesService>(DisputesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('blocks non-parties from filing', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue({
      id: 'c1',
      clientId: 'client-user',
      artist: { userId: 'artist-user' },
    });
    await expect(
      service.file('stranger', { commissionId: 'c1', reason: 'bad' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('files a dispute and flags the commission DISPUTED', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue({
      id: 'c1',
      clientId: 'client-user',
      artist: { userId: 'artist-user' },
    });
    mockPrisma.dispute.create.mockResolvedValue({ id: 'd1' });
    await service.file('client-user', { commissionId: 'c1', reason: 'late' });
    const dataMatcher: unknown = expect.objectContaining({
      filedById: 'client-user',
      againstId: 'artist-user',
    });
    expect(mockPrisma.dispute.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: dataMatcher }),
    );
    expect(mockPrisma.commission.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: CommissionStatus.DISPUTED },
    });
  });

  it('cancels the commission when resolving with a client refund', async () => {
    mockPrisma.dispute.findUnique.mockResolvedValue({
      id: 'd1',
      commissionId: 'c1',
      status: DisputeStatus.UNDER_REVIEW,
    });
    mockPrisma.dispute.update.mockResolvedValue({ id: 'd1' });
    await service.resolve('admin', 'd1', DisputeResolution.REFUND_CLIENT);
    expect(mockPrisma.commission.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: CommissionStatus.CANCELLED },
    });
  });

  it('auto-resolves stale open disputes as SPLIT', async () => {
    mockPrisma.dispute.findMany.mockResolvedValue([{ id: 'a' }]);
    mockPrisma.dispute.updateMany.mockResolvedValue({ count: 1 });
    const res = await service.autoResolveTimeouts(14, new Date());
    expect(res).toEqual({ autoResolved: 1 });
  });
});
