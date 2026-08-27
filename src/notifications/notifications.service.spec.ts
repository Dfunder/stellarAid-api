import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrisma = {
    notification: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    notificationPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    notificationTemplate: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('delivers an in-app notification when no preferences exist', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    mockPrisma.notification.create.mockResolvedValue({ id: 'n1' });
    const res = await service.notify('user-1', {
      type: 'X',
      title: 't',
      message: 'm',
    });
    expect(res).toEqual({ id: 'n1' });
    expect(mockPrisma.notification.create).toHaveBeenCalled();
  });

  it('suppresses a notification whose type is muted', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: true,
      mutedTypes: ['X'],
    });
    const res = await service.notify('user-1', {
      type: 'X',
      title: 't',
      message: 'm',
    });
    expect(res).toBeNull();
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it('suppresses when the requested channel is disabled', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({
      inAppEnabled: true,
      emailEnabled: false,
      pushEnabled: true,
      mutedTypes: [],
    });
    const res = await service.notify('user-1', {
      type: 'X',
      title: 't',
      message: 'm',
      channel: 'EMAIL',
    });
    expect(res).toBeNull();
  });

  it('renders template placeholders when sending from a template', async () => {
    mockPrisma.notificationTemplate.findUnique.mockResolvedValue({
      title: 'Hi {{name}}',
      body: 'Order {{order}} shipped',
      channel: 'IN_APP',
    });
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    mockPrisma.notification.create.mockImplementation(({ data }: any) =>
      Promise.resolve(data),
    );
    const res = await service.sendFromTemplate({
      userId: 'user-1',
      key: 'k',
      type: 'X',
      variables: { name: 'Ada', order: '42' },
    });
    expect(res).toMatchObject({
      title: 'Hi Ada',
      message: 'Order 42 shipped',
    });
  });

  it('throws NotFound sending from a missing template', async () => {
    mockPrisma.notificationTemplate.findUnique.mockResolvedValue(null);
    await expect(
      service.sendFromTemplate({ userId: 'u', key: 'missing', type: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('dispatches due scheduled notifications', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      { id: 'a' },
      { id: 'b' },
    ]);
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 2 });
    const res = await service.processScheduled(new Date());
    expect(res).toEqual({ dispatched: 2 });
  });
});
