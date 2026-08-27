import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ type: [String], description: 'Other participant user ids' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds!: string[];

  @ApiPropertyOptional({ description: 'Optional related commission id' })
  @IsOptional()
  @IsString()
  commissionId?: string;
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({ description: 'Optional attachment URL' })
  @IsOptional()
  @IsUrl()
  attachmentUrl?: string;
}

export class UpdateMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}

export class SearchMessagesDto {
  @ApiProperty({
    description: 'Free-text query matched against message content',
  })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
