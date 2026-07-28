import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateCommissionDto {
  @ApiProperty({ description: 'Artist user ID' })
  @IsUUID()
  @IsNotEmpty()
  artistUserId: string;

  @ApiPropertyOptional({ description: 'Related service ID' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty({
    description: 'Commission title',
    example: 'Custom logo design',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Commission description',
    example: 'I need a modern logo for my startup',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Budget in USDC', example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetUsdc: number;

  @ApiProperty({
    description: 'Deadline',
    example: '2026-08-15T00:00:00.000Z',
  })
  @IsDateString()
  deadline: string;

  @ApiPropertyOptional({
    description: 'Attachment URLs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
