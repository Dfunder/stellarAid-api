import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GeneratePresignedUrlDto {
  @ApiProperty({
    description: 'The name of the file to upload',
    example: 'my-image.jpg',
  })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({
    description: 'The content type of the file to upload',
    example: 'image/jpeg',
  })
  @IsString()
  @IsNotEmpty()
  contentType: string;
}
