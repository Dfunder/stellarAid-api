import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeResolution, DisputeStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class FileDisputeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  commissionId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Evidence attachment URLs',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({}, { each: true })
  evidence?: string[];
}

export class AddEvidenceDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({}, { each: true })
  evidence!: string[];
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: DisputeResolution })
  @IsEnum(DisputeResolution)
  resolution!: DisputeResolution;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RejectDisputeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class AppealDisputeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note!: string;
}

export class QueryDisputeDto {
  @ApiPropertyOptional({ enum: DisputeStatus })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;
}
