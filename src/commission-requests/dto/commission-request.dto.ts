import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubmitCommissionRequestDto {
  @ApiProperty({ description: 'Target artist id' })
  @IsString()
  @IsNotEmpty()
  artistId!: string;

  @ApiPropertyOptional({ description: 'Marketplace service this derives from' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;

  @ApiProperty({
    description: 'Budget in USDC (decimal string)',
    example: '500.00',
  })
  @IsNumberString()
  budgetUsdc!: string;

  @ApiProperty({ description: 'Final deadline (ISO date)' })
  @IsDateString()
  deadline!: string;

  @ApiPropertyOptional({ description: 'Target delivery date (ISO date)' })
  @IsOptional()
  @IsDateString()
  deliveryDueAt?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Initial checklist items',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  checklist?: string[];
}

export class RequestRevisionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  feedback!: string;
}

export class ChecklistItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;
}

export class ToggleChecklistDto {
  @ApiProperty()
  @IsBoolean()
  isDone!: boolean;
}

export class SetDeliveryDateDto {
  @ApiProperty({ description: 'Target delivery date (ISO date)' })
  @IsDateString()
  deliveryDueAt!: string;
}
