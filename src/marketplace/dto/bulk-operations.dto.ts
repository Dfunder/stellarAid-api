import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateServiceDto } from './create-service.dto';
import { UpdateServiceDto } from './update-service.dto';

/** Maximum number of items accepted by any bulk endpoint. */
export const BULK_OPERATION_MAX_ITEMS = 100;

export class BulkCreateServicesDto {
  @ApiProperty({
    description: 'Services to create',
    type: [CreateServiceDto],
    maxItems: BULK_OPERATION_MAX_ITEMS,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_OPERATION_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateServiceDto)
  services: CreateServiceDto[];
}

export class BulkServiceUpdateItemDto extends UpdateServiceDto {
  @ApiProperty({ description: 'Id of the service to update' })
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class BulkUpdateServicesDto {
  @ApiProperty({
    description: 'Service updates to apply',
    type: [BulkServiceUpdateItemDto],
    maxItems: BULK_OPERATION_MAX_ITEMS,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_OPERATION_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => BulkServiceUpdateItemDto)
  services: BulkServiceUpdateItemDto[];
}

export class BulkDeleteServicesDto {
  @ApiProperty({
    description: 'Ids of the services to delete',
    type: [String],
    maxItems: BULK_OPERATION_MAX_ITEMS,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_OPERATION_MAX_ITEMS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids: string[];

  @ApiProperty({
    description: 'Deletion confirmation; the request is rejected unless true',
  })
  @IsBoolean()
  confirm: boolean;
}
