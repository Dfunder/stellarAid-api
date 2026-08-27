import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VerificationStatus, VerificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryVerificationDto } from './dto/verification.dto';

const VERIFICATION_VALID_DAYS = 365;

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireArtist(userId: string) {
    const artist = await this.prisma.artist.findUnique({ where: { userId } });
    if (!artist) {
      throw new ForbiddenException('Only artists can request verification');
    }
    return artist;
  }

  /** Submit a verification request of a given type. */
  async request(
    userId: string,
    type: VerificationType,
    evidence: string[] = [],
  ) {
    const artist = await this.requireArtist(userId);
    const pending = await this.prisma.verificationRequest.findFirst({
      where: {
        artistId: artist.id,
        type,
        status: VerificationStatus.PENDING,
      },
    });
    if (pending) {
      throw new BadRequestException(
        `A ${type} verification request is already pending`,
      );
    }
    return this.prisma.verificationRequest.create({
      data: { artistId: artist.id, type, evidence },
    });
  }

  async listMine(userId: string) {
    const artist = await this.requireArtist(userId);
    return this.prisma.verificationRequest.findMany({
      where: { artistId: artist.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async list(query: QueryVerificationDto) {
    const where: Prisma.VerificationRequestWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    return this.prisma.verificationRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async requireRequest(id: string) {
    const req = await this.prisma.verificationRequest.findUnique({
      where: { id },
    });
    if (!req) {
      throw new NotFoundException('Verification request not found');
    }
    return req;
  }

  /** Admin approves a request; IDENTITY approval grants the verified badge. */
  async approve(adminId: string, id: string, note?: string) {
    const req = await this.requireRequest(id);
    if (req.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved');
    }
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + VERIFICATION_VALID_DAYS * 24 * 60 * 60 * 1000,
    );
    const updated = await this.prisma.verificationRequest.update({
      where: { id },
      data: {
        status: VerificationStatus.APPROVED,
        reviewedById: adminId,
        reviewNote: note,
        approvedAt: now,
        expiresAt,
      },
    });
    if (req.type === VerificationType.IDENTITY) {
      await this.prisma.artist.update({
        where: { id: req.artistId },
        data: { isVerified: true, verifiedAt: now },
      });
    }
    await this.recomputeTrustScore(req.artistId);
    return updated;
  }

  async reject(adminId: string, id: string, note?: string) {
    const req = await this.requireRequest(id);
    if (req.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be rejected');
    }
    return this.prisma.verificationRequest.update({
      where: { id },
      data: {
        status: VerificationStatus.REJECTED,
        reviewedById: adminId,
        reviewNote: note,
      },
    });
  }

  /** Renew an approved verification that is expired or nearing expiry. */
  async renew(userId: string, id: string) {
    const artist = await this.requireArtist(userId);
    const req = await this.requireRequest(id);
    if (req.artistId !== artist.id) {
      throw new ForbiddenException('Not your verification request');
    }
    if (req.status !== VerificationStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved verifications can be renewed',
      );
    }
    return this.prisma.verificationRequest.create({
      data: {
        artistId: artist.id,
        type: req.type,
        evidence: req.evidence,
      },
    });
  }

  /** Badges earned from approved, non-expired verifications and reputation. */
  async badges(artistId: string) {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
    });
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }
    const approved = await this.prisma.verificationRequest.findMany({
      where: { artistId, status: VerificationStatus.APPROVED },
      select: { type: true, expiresAt: true },
    });
    const now = Date.now();
    const active = approved.filter(
      (a) => !a.expiresAt || a.expiresAt.getTime() > now,
    );
    const badges: string[] = [];
    if (artist.isVerified) badges.push('VERIFIED');
    if (active.some((a) => a.type === VerificationType.IDENTITY))
      badges.push('IDENTITY_VERIFIED');
    if (active.some((a) => a.type === VerificationType.EMAIL))
      badges.push('EMAIL_VERIFIED');
    if (active.some((a) => a.type === VerificationType.PORTFOLIO))
      badges.push('PORTFOLIO_VERIFIED');
    if (artist.averageRating >= 4.5 && artist.totalReviews >= 5)
      badges.push('TOP_RATED');
    return { artistId, trustScore: artist.trustScore, badges };
  }

  async getTrustScore(artistId: string) {
    const score = await this.recomputeTrustScore(artistId);
    return { artistId, trustScore: score };
  }

  /**
   * Trust score (0-100) blended from verification, rating, and review volume.
   */
  private async recomputeTrustScore(artistId: string) {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
    });
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }
    const approvedCount = await this.prisma.verificationRequest.count({
      where: { artistId, status: VerificationStatus.APPROVED },
    });

    const verifiedPoints = artist.isVerified ? 30 : 0;
    const ratingPoints = Math.round(artist.averageRating * 8); // up to 40
    const reviewPoints = Math.min(artist.totalReviews, 10) * 2; // up to 20
    const verificationPoints = Math.min(approvedCount, 2) * 5; // up to 10
    const score = Math.min(
      100,
      verifiedPoints + ratingPoints + reviewPoints + verificationPoints,
    );

    await this.prisma.artist.update({
      where: { id: artistId },
      data: { trustScore: score },
    });
    return score;
  }
}
