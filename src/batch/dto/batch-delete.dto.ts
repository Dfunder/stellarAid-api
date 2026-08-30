import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class BatchDeleteDto {
  @ApiProperty({
    description: 'The ID of the service to delete',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID()
  id: string;
}
