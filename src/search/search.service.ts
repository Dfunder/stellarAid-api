import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchDto, SearchType } from './dto';

interface ArtistResult {
  id: string;
  name: string;
  bio: string | null;
  tagline: string | null;
  profilePhotoUrl: string | null;
  isVerified: boolean;
  averageRating: number;
  rank: number;
}

interface PortfolioResult {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  coverImageUrl: string;
  artistId: string;
  artistName: string;
  rank: number;
}

interface ServiceResult {
  id: string;
  title: string;
  description: string;
  category: string;
  priceUsdc: string;
  deliveryDays: number;
  isActive: boolean;
  artistId: string;
  artistName: string;
  rank: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchDto) {
    const tsQuery = dto.q
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `${word}:*`)
      .join(' & ');

    if (!tsQuery) {
      return { artists: [], portfolios: [], services: [] };
    }

    const results: {
      artists: ArtistResult[];
      portfolios: PortfolioResult[];
      services: ServiceResult[];
    } = { artists: [], portfolios: [], services: [] };

    if (!dto.type || dto.type === SearchType.ARTISTS) {
      results.artists = await this.searchArtists(tsQuery);
    }

    if (!dto.type || dto.type === SearchType.PORTFOLIOS) {
      results.portfolios = await this.searchPortfolios(tsQuery);
    }

    if (!dto.type || dto.type === SearchType.SERVICES) {
      results.services = await this.searchServices(tsQuery);
    }

    return results;
  }

  private async searchArtists(tsQuery: string): Promise<ArtistResult[]> {
    const rows = await this.prisma.$queryRaw<ArtistResult[]>`
      SELECT
        a."id",
        u."name",
        a."bio",
        a."tagline",
        a."profilePhotoUrl",
        a."isVerified",
        a."averageRating",
        ts_rank_cd(
          to_tsvector('english', coalesce(u."name", '') || ' ' || coalesce(a."bio", '') || ' ' || coalesce(a."tagline", '')),
          to_tsquery('english', ${tsQuery})
        ) AS rank
      FROM "Artist" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE to_tsvector('english', coalesce(u."name", '') || ' ' || coalesce(a."bio", '') || ' ' || coalesce(a."tagline", ''))
            @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC
      LIMIT 20
    `;
    return rows;
  }

  private async searchPortfolios(tsQuery: string): Promise<PortfolioResult[]> {
    const rows = await this.prisma.$queryRaw<PortfolioResult[]>`
      SELECT
        p."id",
        p."title",
        p."description",
        p."category"::text AS "category",
        p."tags",
        p."coverImageUrl",
        p."artistId",
        u."name" AS "artistName",
        ts_rank_cd(
          to_tsvector('english', coalesce(p."title", '') || ' ' || coalesce(p."description", '') || ' ' || coalesce(array_to_string(p."tags", ' '), '')),
          to_tsquery('english', ${tsQuery})
        ) AS rank
      FROM "Portfolio" p
      JOIN "Artist" a ON a."id" = p."artistId"
      JOIN "User" u ON u."id" = a."userId"
      WHERE p."isPublished" = true
        AND to_tsvector('english', coalesce(p."title", '') || ' ' || coalesce(p."description", '') || ' ' || coalesce(array_to_string(p."tags", ' '), ''))
            @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC
      LIMIT 20
    `;
    return rows;
  }

  private async searchServices(tsQuery: string): Promise<ServiceResult[]> {
    const rows = await this.prisma.$queryRaw<ServiceResult[]>`
      SELECT
        s."id",
        s."title",
        s."description",
        s."category",
        s."priceUsdc"::text AS "priceUsdc",
        s."deliveryDays",
        s."isActive",
        s."artistId",
        u."name" AS "artistName",
        ts_rank_cd(
          to_tsvector('english', coalesce(s."title", '') || ' ' || coalesce(s."description", '') || ' ' || coalesce(s."category", '')),
          to_tsquery('english', ${tsQuery})
        ) AS rank
      FROM "Service" s
      JOIN "Artist" a ON a."id" = s."artistId"
      JOIN "User" u ON u."id" = a."userId"
      WHERE s."isActive" = true
        AND to_tsvector('english', coalesce(s."title", '') || ' ' || coalesce(s."description", '') || ' ' || coalesce(s."category", ''))
            @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC
      LIMIT 20
    `;
    return rows;
  }
}
