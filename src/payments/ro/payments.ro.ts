import { ApiProperty } from '@nestjs/swagger';

export class InitiateEscrowResponse {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  paymentId: string;

  @ApiProperty({ example: 'AAAAAgAAAAC5kL34KjY9...' })
  unsignedXdr: string;

  @ApiProperty({ example: 100 })
  amount: number;

  @ApiProperty({ example: 'XLM' })
  assetCode: string;

  @ApiProperty({ example: 2 })
  platformFee: number;
}

export class ConfirmPaymentResponse {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  paymentId: string;

  @ApiProperty({
    example: '4a71b28c6e2646d6d45e52514101e4054a3dc43272e7d722bf1359d9544c8b0c',
  })
  txHash: string;

  @ApiProperty({ example: 'CONFIRMED' })
  status: string;
}

export class ReleasePaymentResponse {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  paymentId: string;

  @ApiProperty({
    example: '89b524cae42095f9c9b4e7235a92a5b1f0923e59b794f386d8a7c2937e0c451d',
  })
  txHash: string;

  @ApiProperty({ example: 'RELEASED' })
  status: string;

  @ApiProperty({ example: 98 })
  netAmount: number;

  @ApiProperty({ example: 'XLM' })
  assetCode: string;
}
