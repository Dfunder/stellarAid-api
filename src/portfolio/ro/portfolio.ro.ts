import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PortfolioCategory } from '@prisma/client';

export class PortfolioItemResponse {
  @ApiProperty({ example: 'item-uuid-1234', description: 'Unique identifier of the portfolio item' })
  id: string;

  @ApiProperty({ example: 'portfolio-uuid-1234', description: 'ID of the parent portfolio' })
  portfolioId: string;

  @ApiProperty({ example: 'https://cdn.lumora.art/items/art1.png', description: 'URL of the media asset' })
  imageUrl: string;

  @ApiProperty({ example: 'Sunset Over Dunes', description: 'Title of the media item' })
  title: string;

  @ApiProperty({ example: '3D rendering using Blender and Cycles engine', description: 'Description of the item' })
  description: string;

  @ApiProperty({ example: 0, description: 'Display order index' })
  order: number;

  @ApiProperty({ example: '2026-09-23T12:00:00.000Z', description: 'Creation timestamp' })
  createdAt: Date;
}

export class PortfolioResponse {
  @ApiProperty({ example: 'portfolio-uuid-1234', description: 'Unique identifier of the portfolio' })
  id: string;

  @ApiProperty({ example: 'artist-uuid-5678', description: 'Artist ID who owns this portfolio' })
  artistId: string;

  @ApiProperty({ example: 'Sci-Fi Character Concept Art', description: 'Portfolio project title' })
  title: string;

  @ApiProperty({ example: 'A collection of futuristic character concepts and illustrations', description: 'Project description' })
  description: string;

  @ApiProperty({ enum: PortfolioCategory, example: PortfolioCategory.ILLUSTRATION, description: 'Category of portfolio' })
  category: PortfolioCategory;

  @ApiProperty({ type: [String], example: ['sci-fi', 'concept-art', 'character-design'], description: 'List of tags' })
  tags: string[];

  @ApiProperty({ example: 'https://cdn.lumora.art/covers/hero.png', description: 'Hero cover image URL' })
  coverImageUrl: string;

  @ApiProperty({ example: true, description: 'Whether the portfolio is publicly visible' })
  isPublished: boolean;

  @ApiProperty({ example: 142, description: 'Lifetime view impressions' })
  viewCount: number;

  @ApiProperty({ example: '2026-09-23T12:00:00.000Z', description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ example: '2026-09-23T12:00:00.000Z', description: 'Last update timestamp' })
  updatedAt: Date;
}

export class PortfolioDetailResponse extends PortfolioResponse {
  @ApiProperty({ type: () => [PortfolioItemResponse], description: 'Media items contained in the portfolio' })
  items: PortfolioItemResponse[];
}

export class PaginatedPortfoliosResponse {
  @ApiProperty({ type: () => [PortfolioResponse], description: 'List of matching portfolios' })
  items: PortfolioResponse[];

  @ApiProperty({ example: 45, description: 'Total number of items matching filters' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 20, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 3, description: 'Total available pages' })
  totalPages: number;
}

export class PortfolioAnalyticsResponse {
  @ApiProperty({ example: 'portfolio-uuid-1234', description: 'Portfolio ID' })
  portfolioId: string;

  @ApiProperty({ example: 142, description: 'Total lifetime views' })
  lifetimeViews: number;

  @ApiProperty({
    example: [
      { date: '2026-09-22', views: 35 },
      { date: '2026-09-23', views: 42 },
    ],
    description: 'Daily view counts for the tracking window',
  })
  dailyViews: Array<{ date: string; views: number }>;
}
