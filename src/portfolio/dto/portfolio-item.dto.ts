import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePortfolioItemDto {
  @ApiProperty({ description: 'URL of the media asset in object storage' })
  @IsUrl()
  imageUrl!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ description: 'Display order (0-indexed)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
