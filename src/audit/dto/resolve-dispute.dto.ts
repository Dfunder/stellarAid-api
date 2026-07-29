import { IsEnum, IsOptional, IsNumber } from 'class-validator';

export enum DisputeResolution {
  REFUND = 'REFUND',
  RELEASE = 'RELEASE',
  PARTIAL = 'PARTIAL',
}

export class ResolveDisputeDto {
  @IsEnum(DisputeResolution)
  resolution: DisputeResolution;

  @IsOptional()
  @IsNumber()
  artistShareBps?: number;
}