import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProfileService', () => {
  let service: ProfileService;

  const mockPrisma = {
    artist: { findUnique: jest.fn(), update: jest.fn() },
  };

  const fullArtist = {
    bio: 'b',
    tagline: 't',
    profilePhotoUrl: 'https://x/a.png',
    coverPhotoUrl: 'https://x/c.png',
    skills: ['illustration'],
    socialLinks: { twitter: 'https://t/x' },
    isVerified: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects profile access for non-artists', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue(null);
    await expect(service.getMyProfile('u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('scores a fully-filled profile at 100 with no missing fields', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue(fullArtist);
    const res = await service.getCompleteness('u1');
    expect(res.score).toBe(100);
    expect(res.missing).toEqual([]);
  });

  it('reports missing fields and a reduced score', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue({
      ...fullArtist,
      bio: null,
      skills: [],
    });
    const res = await service.getCompleteness('u1');
    expect(res.score).toBe(60);
    expect(res.missing).toEqual(expect.arrayContaining(['bio', 'skills']));
  });

  it('hides non-public profiles from public lookup', async () => {
    mockPrisma.artist.findUnique.mockResolvedValue({
      id: 'a1',
      isProfilePublic: false,
    });
    await expect(service.getPublicProfile('a1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
