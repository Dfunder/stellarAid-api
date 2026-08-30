import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class UpdateServiceDto {
  @ApiProperty({
    description: 'The ID of the service to update',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'The updated name of the service',
    example: 'My Awesome Service',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'The updated description of the service',
    example: 'A very cool service that does amazing things.',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
