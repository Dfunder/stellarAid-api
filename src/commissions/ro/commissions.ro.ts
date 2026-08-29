import { ApiProperty } from '@nestjs/swagger';

export class CommissionResponse {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'New Commission' })
  title: string;

  @ApiProperty({ example: 'This is a new commission' })
  description: string;

  @ApiProperty({ example: 100 })
  budget: number;

  @ApiProperty({ example: '2022-12-31T23:59:59.999Z' })
  deadline: string;

  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  artistId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  clientId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  serviceId: string;
}

export class CommissionsResponse {
  @ApiProperty({ type: () => [CommissionResponse] })
  commissions: CommissionResponse[];
}
