import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryReviewDto {
  @ApiPropertyOptional({ description: 'Filter by artist id' })
  @IsOptional()
  @IsString()
  artistId?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'rating', 'helpfulCount'] })
  @IsOptional()
  @IsIn(['createdAt', 'rating', 'helpfulCount'])
  sortBy?: 'createdAt' | 'rating' | 'helpfulCount' = 'createdAt';

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
