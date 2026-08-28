import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';

export class BatchOperationDto {
  @IsString()
  @MaxLength(64)
  id!: string;

  @IsIn(['echo', 'health'])
  type!: 'echo' | 'health';

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class BatchRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BatchOperationDto)
  operations!: BatchOperationDto[];
}
