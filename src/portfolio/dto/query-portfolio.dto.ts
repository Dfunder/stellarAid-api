import { ApiPropertyOptional } from '@nestjs/swagger';
import { PortfolioCategory } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryPortfolioDto {
  @ApiPropertyOptional({ enum: PortfolioCategory })
  @IsOptional()
  @IsEnum(PortfolioCategory)
  category?: PortfolioCategory;

  @ApiPropertyOptional({ description: 'Comma-separated tag filter' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter by published state' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ enum: ['createdAt', 'viewCount', 'title'] })
  @IsOptional()
  @IsIn(['createdAt', 'viewCount', 'title'])
  sortBy?: 'createdAt' | 'viewCount' | 'title' = 'createdAt';

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
