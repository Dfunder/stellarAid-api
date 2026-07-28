import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MilestoneInputDto {
  @ApiProperty({ description: 'Milestone title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Milestone description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Amount in USDC' })
  amountUsdc: number;

  @ApiProperty({ description: 'Due date' })
  @IsDateString()
  dueDate: string;
}

export class CreateMilestonesDto {
  @ApiProperty({ description: 'List of milestones', type: [MilestoneInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneInputDto)
  milestones: MilestoneInputDto[];
}
