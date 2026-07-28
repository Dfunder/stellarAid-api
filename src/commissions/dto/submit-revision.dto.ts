import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class SubmitCommissionDto {
  @ApiProperty({ description: 'Deliverable file URLs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  deliverableUrls: string[];
}

export class RequestRevisionDto {
  @ApiPropertyOptional({ description: 'Revision note from client' })
  @IsOptional()
  @IsString()
  note?: string;
}
