import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ConnectWalletDto {
  @ApiProperty({
    description: 'Stellar public key (starts with G)',
    example: 'GBZ3SZP5M4W7NABVA2WQXMFY3GC7GXI6OU4RLN4U5DSQXQRESR5YIXU6',
  })
  @IsString()
  publicKey: string;
}
