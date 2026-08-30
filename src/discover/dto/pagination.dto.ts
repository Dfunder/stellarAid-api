import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { PaginationRequest } from '../../common/pagination/pagination.dto';
import { FieldsDto } from '../../common/query/fields.dto';

export class DiscoverPaginationDto extends PaginationRequest {
  @ApiProperty({ description: 'Category to filter by' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ type: FieldsDto })
  fields: FieldsDto;
}
