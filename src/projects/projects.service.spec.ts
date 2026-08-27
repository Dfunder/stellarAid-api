import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MilestoneStatus } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProjectsService', () => {
  let service: ProjectsService;

  const mockPrisma = {
    commission: { findUnique: jest.fn() },
    milestone: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notification: { create: jest.fn() },
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
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('only lets the artist create milestones', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue(parties);
    await expect(
      service.create('client-user', 'c1', {
        title: 't',
        description: 'd',
        amountUsdc: '10',
        dueDate: '2030-01-01',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks approval unless the milestone is submitted', async () => {
    mockPrisma.milestone.findUnique.mockResolvedValue({
      id: 'm1',
      commissionId: 'c1',
      status: MilestoneStatus.IN_PROGRESS,
    });
    mockPrisma.commission.findUnique.mockResolvedValue(parties);
    await expect(service.approve('client-user', 'm1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('releases payment and notifies the artist', async () => {
    mockPrisma.milestone.findUnique.mockResolvedValue({
      id: 'm1',
      commissionId: 'c1',
      title: 'Phase 1',
      status: MilestoneStatus.APPROVED,
    });
    mockPrisma.commission.findUnique.mockResolvedValue(parties);
    mockPrisma.milestone.update.mockResolvedValue({ id: 'm1' });
    await service.releasePayment('client-user', 'm1');
    const dataMatcher: unknown = expect.objectContaining({
      userId: 'artist-user',
      type: 'MILESTONE_PAID',
    });
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: dataMatcher }),
    );
  });

  it('computes progress percentage from milestone statuses', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue(parties);
    mockPrisma.milestone.findMany.mockResolvedValue([
      {
        id: 'm1',
        title: 'a',
        dueDate: new Date(),
        status: MilestoneStatus.PAID,
        completedAt: new Date(),
      },
      {
        id: 'm2',
        title: 'b',
        dueDate: new Date(),
        status: MilestoneStatus.PENDING,
        completedAt: null,
      },
    ]);
    const res = await service.progress('client-user', 'c1');
    expect(res.percentComplete).toBe(50);
    expect(res.total).toBe(2);
  });
});
