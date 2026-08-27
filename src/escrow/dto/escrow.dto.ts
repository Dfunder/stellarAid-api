import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEscrowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  commissionId!: string;

  @ApiPropertyOptional({ description: 'Milestone this escrow is scoped to' })
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @ApiProperty({
    description: 'USDC amount to hold (decimal string)',
    example: '250.00',
  })
  @IsNumberString()
  amountUsdc!: string;

  @ApiPropertyOptional({ description: 'On-chain hold transaction hash' })
  @IsOptional()
  @IsString()
  txHash?: string;
}

export class EscrowActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: 'On-chain settlement transaction hash' })
  @IsOptional()
  @IsString()
  txHash?: string;
}
