import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SanitizeString } from '../../common/validation/sanitize-string.decorator';

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
  @SanitizeString()
  @IsString()
  @IsNotEmpty()
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
