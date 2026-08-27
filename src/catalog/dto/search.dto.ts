import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SearchServicesDto {
  @ApiPropertyOptional({ description: 'Free-text query (title/description)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Service category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Minimum price (USDC)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price (USDC)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Minimum artist rating (0-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Maximum delivery days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDeliveryDays?: number;

  @ApiPropertyOptional({ description: 'Artist location filter' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: ['relevance', 'price', 'rating', 'newest'] })
  @IsOptional()
  @IsIn(['relevance', 'price', 'rating', 'newest'])
  sortBy?: 'relevance' | 'price' | 'rating' | 'newest' = 'relevance';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SaveSearchDto {
  @ApiPropertyOptional({ description: 'Label for the saved search' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Filter/sort parameters to persist' })
  @IsOptional()
  query?: SearchServicesDto;
}
