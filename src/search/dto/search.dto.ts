import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum SearchType {
  ARTISTS = 'artists',
  PORTFOLIOS = 'portfolios',
  SERVICES = 'services',
}

export class SearchDto {
  @ApiPropertyOptional({
    description: 'Search query string',
    example: 'logo design',
  })
  @IsString()
  q: string;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    enum: SearchType,
    example: SearchType.ARTISTS,
  })
  @IsOptional()
  @IsEnum(SearchType)
  type?: SearchType;
}
