import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type KycDocument = Kyc & Document;

export enum KycDocumentType {
  PASSPORT = 'passport',
  NATIONAL_ID = 'national_id',
  DRIVERS_LICENSE = 'drivers_license',
}

export enum KycReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({
  collection: 'kyc',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      const idSource = ret._id as { toString(): string } | undefined;
      ret.id = idSource?.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Kyc {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(KycDocumentType), required: true })
  documentType!: KycDocumentType;

  @Prop({ type: String, required: true })
  documentUrl!: string;

  @Prop({ type: String, enum: Object.values(KycReviewStatus), default: KycReviewStatus.PENDING })
  status!: KycReviewStatus;

  @Prop({ type: Date, default: null })
  reviewedAt!: Date | null;

  @Prop({ type: String, default: null })
  reviewNote!: string | null;

  @Prop({ type: Date })
  createdAt!: Date;

  @Prop({ type: Date })
  updatedAt!: Date;
}

export const KycSchema = SchemaFactory.createForClass(Kyc);

KycSchema.index({ userId: 1 });
