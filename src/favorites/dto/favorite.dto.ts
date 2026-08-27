import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddFavoriteDto {
  @ApiProperty({ description: 'Service id to add to favourites' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;
}
