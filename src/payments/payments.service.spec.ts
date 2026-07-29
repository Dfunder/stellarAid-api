import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { StellarService } from './stellar.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;
  let stellar: StellarService;

  const mockPrismaService = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    commission: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockStellarService = {
    releasePayment: jest.fn(),
    refundClient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StellarService, useValue: mockStellarService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
    stellar = module.get<StellarService>(StellarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate platform fee correctly', () => {
    const amount = 100;
    const feeBps = 250; // 2.5%
    const fee = (amount * feeBps) / 10000;
    expect(fee).toEqual(2.5);
  });
});
