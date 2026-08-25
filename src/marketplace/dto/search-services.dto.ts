import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SanitizeString } from '../../common/validation/sanitize-string.decorator';

export class SearchServicesDto {
  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @SanitizeString()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @SanitizeString()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Minimum price in USDC' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price in USDC' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Max delivery days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deliveryDays?: number;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['price-asc', 'price-desc', 'newest', 'top-rated'],
  })
  @IsOptional()
  @SanitizeString()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
