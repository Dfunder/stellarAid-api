import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  IsString,
  IsOptional,
  IsIn,
} from 'class-validator';

export const SUPPORTED_ASSETS = ['XLM', 'USDC', 'NGNT', 'EURC'] as const;
export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

export class InitiateEscrowDto {
  @ApiProperty({
    description: 'Amount in the chosen asset',
    example: 100,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Stellar asset code',
    enum: SUPPORTED_ASSETS,
    example: 'USDC',
  })
  @IsString()
  @IsIn(SUPPORTED_ASSETS)
  assetCode: SupportedAsset;

  @ApiPropertyOptional({
    description: 'Asset issuer public key (required for non-XLM assets)',
    example: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  })
  @IsOptional()
  @IsString()
  assetIssuer?: string;

  @ApiProperty({
    description: 'Client Stellar wallet public key',
    example: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  })
  @IsString()
  clientWallet: string;

  @ApiPropertyOptional({
    description: 'Optional milestone ID to tie this payment to',
  })
  @IsOptional()
  @IsString()
  milestoneId?: string;
}
