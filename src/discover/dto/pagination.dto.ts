import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { PaginationRequest } from '../../common/pagination/pagination.dto';

export class DiscoverPaginationDto extends PaginationRequest {
  @ApiProperty({ description: 'Category to filter by' })
  @IsString()
  @IsNotEmpty()
  category: string;
}
