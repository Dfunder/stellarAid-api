import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProjectDocument = Project & Document;

export enum ProjectStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
}

@Schema({
  collection: 'projects',
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
export class Project {
  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({ type: String, required: true, trim: true })
  description!: string;

  @Prop({ type: String, required: true, trim: true })
  category!: string;

  @Prop({ type: Number, required: true, min: 0 })
  goalAmount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  raisedAmount!: number;

  @Prop({ type: String, default: 'XLM', trim: true })
  currency!: string;

  @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
  owner!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  stellarAddress!: string;

  @Prop({
    type: String,
    enum: Object.values(ProjectStatus),
    default: ProjectStatus.PENDING,
  })
  status!: ProjectStatus;

  @Prop({ type: String, default: null })
  coverImage!: string | null;

  @Prop({ type: [String], default: [] })
  documents!: string[];

  @Prop({ type: Date, required: true })
  startDate!: Date;

  @Prop({ type: Date, required: true })
  endDate!: Date;

  @Prop({ type: Date })
  createdAt!: Date;

  @Prop({ type: Date })
  updatedAt!: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

ProjectSchema.index({ status: 1, owner: 1 });
ProjectSchema.index({ owner: 1 });
