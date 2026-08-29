import { ApiProperty } from '@nestjs/swagger';

export class ServiceResponse {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'New Service' })
  title: string;

  @ApiProperty({ example: 'This is a new service' })
  description: string;

  @ApiProperty({ example: 100 })
  price: number;

  @ApiProperty({ example: 'ART' })
  category: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  artistId: string;
}

export class ServicesResponse {
  @ApiProperty({ type: () => [ServiceResponse] })
  services: ServiceResponse[];
}

export class PortfolioResponse {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'My Portfolio' })
  title: string;

  @ApiProperty({ example: 'This is my portfolio' })
  description: string;

  @ApiProperty({ type: () => [ServiceResponse] })
  services: ServiceResponse[];
}

export class FeaturedContentResponse {
  @ApiProperty({ type: () => [ServiceResponse] })
  services: ServiceResponse[];

  @ApiProperty({ type: () => [PortfolioResponse] })
  portfolios: PortfolioResponse[];
}
