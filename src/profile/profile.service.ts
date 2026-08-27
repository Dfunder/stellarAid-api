import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto, UpdateSocialLinksDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireArtist(userId: string) {
    const artist = await this.prisma.artist.findUnique({ where: { userId } });
    if (!artist) {
      throw new ForbiddenException('Only artists have editable profiles');
    }
    return artist;
  }

  async getMyProfile(userId: string) {
    const artist = await this.requireArtist(userId);
    return { ...artist, completeness: this.completeness(artist) };
  }

  async getPublicProfile(artistId: string) {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
    });
    if (!artist || !artist.isProfilePublic) {
      throw new NotFoundException('Profile not found');
    }
    return artist;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.requireArtist(userId);
    const updated = await this.prisma.artist.update({
      where: { userId },
      data: { ...dto },
    });
    return { ...updated, completeness: this.completeness(updated) };
  }

  async updateSocialLinks(userId: string, dto: UpdateSocialLinksDto) {
    await this.requireArtist(userId);
    const socialLinks = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    ) as Prisma.InputJsonValue;
    return this.prisma.artist.update({
      where: { userId },
      data: { socialLinks },
    });
  }

  async setVisibility(userId: string, isProfilePublic: boolean) {
    await this.requireArtist(userId);
    return this.prisma.artist.update({
      where: { userId },
      data: { isProfilePublic },
    });
  }

  async getCompleteness(userId: string) {
    const artist = await this.requireArtist(userId);
    return this.completeness(artist);
  }

  /**
   * Weighted profile-completeness score (0-100) used to nudge artists toward
   * filling out their profile.
   */
  private completeness(artist: {
    bio: string | null;
    tagline: string | null;
    profilePhotoUrl: string | null;
    coverPhotoUrl: string | null;
    skills: string[];
    socialLinks: unknown;
    isVerified: boolean;
  }) {
    const checks: Array<{ field: string; done: boolean; weight: number }> = [
      { field: 'bio', done: !!artist.bio, weight: 20 },
      { field: 'tagline', done: !!artist.tagline, weight: 10 },
      { field: 'profilePhotoUrl', done: !!artist.profilePhotoUrl, weight: 20 },
      { field: 'coverPhotoUrl', done: !!artist.coverPhotoUrl, weight: 10 },
      { field: 'skills', done: artist.skills.length > 0, weight: 20 },
      {
        field: 'socialLinks',
        done:
          !!artist.socialLinks && Object.keys(artist.socialLinks).length > 0,
        weight: 10,
      },
      { field: 'verified', done: artist.isVerified, weight: 10 },
    ];
    const score = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
    return {
      score,
      missing: checks.filter((c) => !c.done).map((c) => c.field),
    };
  }
}
