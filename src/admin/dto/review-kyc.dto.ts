import { IsEnum, IsOptional, IsString } from 'class-validator';
import { KycReviewStatus } from '../../kyc/schemas/kyc.schema';

export class ReviewKycDto {
  @IsEnum([KycReviewStatus.APPROVED, KycReviewStatus.REJECTED])
  status!: KycReviewStatus.APPROVED | KycReviewStatus.REJECTED;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
