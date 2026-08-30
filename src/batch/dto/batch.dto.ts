import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
  IsUUID,
} from 'class-validator';

export class BatchOperationDto {
  @ApiProperty({
    description: 'A client-generated ID for the operation',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'The type of operation to perform',
    example: 'insert',
  })
  @IsString()
  @IsIn(['health', 'insert', 'update', 'delete'])
  type: string;

  @ApiProperty({
    description: 'The data for the operation',
    example: [{ name: 'Service 1' }, { name: 'Service 2' }],
  })
  @IsOptional()
  data?: any;
}

export class BatchRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BatchOperationDto)
  operations!: BatchOperationDto[];
}
