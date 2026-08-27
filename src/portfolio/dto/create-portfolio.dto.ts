import { ApiProperty } from '@nestjs/swagger';
import { PortfolioCategory } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreatePortfolioDto {
  @ApiProperty({ description: 'Title of the portfolio project' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ description: 'Detailed description of the project' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ enum: PortfolioCategory })
  @IsEnum(PortfolioCategory)
  category!: PortfolioCategory;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'URL to the cover/hero image' })
  @IsUrl()
  coverImageUrl!: string;
}
