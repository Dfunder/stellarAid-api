import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { VerificationType } from '@prisma/client';
import { VerificationService } from './verification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('VerificationService', () => {
  let service: VerificationService;

  const mockPrisma = {
    artist: { findUnique: jest.fn(), update: jest.fn() },
    verificationRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<VerificationService>(VerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects verification requests from non-artists', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue(null);
    await expect(
      service.request('u1', VerificationType.EMAIL),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents a duplicate pending request of the same type', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue({ id: 'a1' });
    mockPrisma.verificationRequest.findFirst.mockResolvedValue({ id: 'x' });
    await expect(
      service.request('u1', VerificationType.EMAIL),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('grants the verified badge on IDENTITY approval and recomputes score', async () => {
    mockPrisma.verificationRequest.findUnique.mockResolvedValue({
      id: 'r1',
      artistId: 'a1',
      type: VerificationType.IDENTITY,
      status: 'PENDING',
    });
    mockPrisma.verificationRequest.update.mockResolvedValue({ id: 'r1' });
    mockPrisma.artist.findUnique.mockResolvedValue({
      id: 'a1',
      isVerified: true,
      averageRating: 5,
      totalReviews: 10,
    });
    mockPrisma.verificationRequest.count.mockResolvedValue(1);
    await service.approve('admin', 'r1');
    const dataMatcher: unknown = expect.objectContaining({ isVerified: true });
    expect(mockPrisma.artist.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1' },
        data: dataMatcher,
      }),
    );
  });

  it('caps trust score at 100', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue({
      id: 'a1',
      isVerified: true,
      averageRating: 5,
      totalReviews: 50,
    });
    mockPrisma.verificationRequest.count.mockResolvedValue(5);
    const res = await service.getTrustScore('a1');
    expect(res.trustScore).toBe(100);
  });
});
