import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({
    description: 'Payment record ID to confirm',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  paymentId: string;

  @ApiProperty({
    description: 'Signed Stellar transaction XDR returned by client wallet',
    example: 'AAAAAgAAAAA...',
  })
  @IsString()
  signedXdr: string;
}
