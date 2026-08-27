import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('MessagingService', () => {
  let service: MessagingService;

  const mockPrisma = {
    conversation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const mockNotifications = { notify: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get<MessagingService>(MessagingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('blocks non-participants from reading messages', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      participantIds: ['other'],
    });
    await expect(service.getMessages('user-1', 'c1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sends a message and notifies the other participants', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      participantIds: ['user-1', 'user-2'],
    });
    mockPrisma.message.create.mockResolvedValue({ id: 'm1' });
    await service.sendMessage('user-1', 'c1', { content: 'hi' });
    expect(mockPrisma.message.create).toHaveBeenCalled();
    expect(mockNotifications.notify).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({ type: 'MESSAGE_RECEIVED' }),
    );
  });

  it('throws NotFound when editing a missing message', async () => {
    mockPrisma.message.findUnique.mockResolvedValue(null);
    await expect(
      service.updateMessage('user-1', 'missing', 'x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks received unread messages as read', async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      participantIds: ['user-1', 'user-2'],
    });
    mockPrisma.message.updateMany.mockResolvedValue({ count: 3 });
    const res = await service.markRead('user-1', 'c1');
    expect(res).toEqual({ markedRead: 3 });
  });
});
