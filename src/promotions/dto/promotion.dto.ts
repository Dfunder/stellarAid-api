import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromotionTier } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePromotionDto {
  @ApiProperty({ description: 'Service to promote' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiPropertyOptional({ enum: PromotionTier })
  @IsOptional()
  @IsEnum(PromotionTier)
  tier?: PromotionTier;

  @ApiProperty({ description: 'Promotion window start (ISO)' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ description: 'Promotion window end (ISO)' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ description: 'Amount paid for the promotion (USDC)' })
  @IsOptional()
  @IsNumberString()
  amountPaidUsdc?: string;
}
