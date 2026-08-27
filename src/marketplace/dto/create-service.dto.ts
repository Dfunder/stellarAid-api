import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SanitizeString } from '../../common/validation/sanitize-string.decorator';

export class CreateServiceDto {
  @ApiProperty({ description: 'Service title', example: 'Logo Design' })
  @SanitizeString()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Service description',
    example: 'Professional logo design with unlimited revisions',
  })
  @SanitizeString()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Service category', example: 'GRAPHIC_DESIGN' })
  @SanitizeString()
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Price in USDC', example: 50 })
  @IsNumber()
  @Min(0)
  priceUsdc: number;

  @ApiProperty({ description: 'Delivery time in days', example: 7 })
  @IsInt()
  @Min(1)
  deliveryDays: number;

  @ApiProperty({ description: 'Number of revisions included', example: 3 })
  @IsInt()
  @Min(0)
  revisions: number;

  @ApiProperty({
    description: 'List of features included',
    example: ['Source file', 'High resolution'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((item: string) => item.trim()) : value,
  )
  features: string[];

  @ApiProperty({
    description: 'Additional notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  @SanitizeString()
  notes?: string;
}
