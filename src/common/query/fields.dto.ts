import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FieldsDto {
  @ApiPropertyOptional({
    description: 'Fields to include in the response (comma-separated)',
    example: 'id,name,email',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}
