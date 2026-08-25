import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SanitizeString } from '../../common/validation/sanitize-string.decorator';

export class UpdateServiceDto {
  @ApiPropertyOptional({ description: 'Service title' })
  @IsOptional()
  @SanitizeString()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Service description' })
  @IsOptional()
  @SanitizeString()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Service category' })
  @IsOptional()
  @SanitizeString()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Price in USDC' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUsdc?: number;

  @ApiPropertyOptional({ description: 'Delivery time in days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  deliveryDays?: number;

  @ApiPropertyOptional({ description: 'Number of revisions' })
  @IsOptional()
  @IsInt()
  @Min(0)
  revisions?: number;

  @ApiPropertyOptional({ description: 'List of features', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((item) => item.trim()) : value,
  )
  features?: string[];

  @ApiPropertyOptional({ description: 'Whether service is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
