import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EscrowStatus } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EscrowService', () => {
  let service: EscrowService;

  const mockPrisma = {
    commission: { findUnique: jest.fn() },
    escrow: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<EscrowService>(EscrowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('holds funds and records a HOLD event', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue({ id: 'c1' });
    mockPrisma.escrow.create.mockResolvedValue({ id: 'e1' });
    await service.hold({ commissionId: 'c1', amountUsdc: '100' });
    const noteMatcher: unknown = expect.any(String);
    const dataMatcher: unknown = expect.objectContaining({
      status: EscrowStatus.HELD,
      events: { create: { action: 'HOLD', note: noteMatcher } },
    });
    expect(mockPrisma.escrow.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: dataMatcher }),
    );
  });

  it('rejects holding escrow for a missing commission', async () => {
    mockPrisma.commission.findUnique.mockResolvedValue(null);
    await expect(
      service.hold({ commissionId: 'missing', amountUsdc: '1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to release an already-refunded escrow', async () => {
    mockPrisma.escrow.findUnique.mockResolvedValue({
      id: 'e1',
      status: EscrowStatus.REFUNDED,
    });
    await expect(service.release('admin', 'e1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('releases a held escrow to RELEASED', async () => {
    mockPrisma.escrow.findUnique.mockResolvedValue({
      id: 'e1',
      status: EscrowStatus.HELD,
    });
    mockPrisma.escrow.update.mockResolvedValue({ id: 'e1' });
    await service.release('admin', 'e1', 'ok');
    const dataMatcher: unknown = expect.objectContaining({
      status: EscrowStatus.RELEASED,
    });
    expect(mockPrisma.escrow.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: dataMatcher }),
    );
  });
});
