import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Query } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export type UserDocument = User & Document;

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export enum KycStatus {
  NOT_SUBMITTED = 'not_submitted',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Comprehensive User schema. Brings every field the auth/email/password
 * workflow needs into one Mongoose model so downstream PRs can build on
 * a stable schema instead of each adding fields in isolation.
 */
@Schema({
  collection: 'users',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      const idSource = ret._id as { toString(): string } | undefined;
      ret.id = idSource?.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.refreshTokenHash;
      delete ret.passwordResetToken;
      delete ret.emailVerificationToken;
      return ret;
    },
  },
})
export class User {
  @Prop({ type: String, required: true, trim: true })
  fullName!: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ type: String, required: true, minlength: 8 })
  password!: string;

  @Prop({ type: String, enum: Object.values(UserRole), default: UserRole.USER })
  role!: UserRole;

  @Prop({ type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Prop({ type: Boolean, default: false })
  isVerified!: boolean;

  @Prop({ type: String, enum: Object.values(KycStatus), default: KycStatus.NOT_SUBMITTED })
  kycStatus!: KycStatus;

  @Prop({ type: Date, default: null })
  kycSubmissionDate!: Date | null;

  @Prop({ type: String, default: null })
  kycReviewNotes!: string | null;

  @Prop({ type: String, default: null })
  walletAddress!: string | null;

  // --- email verification tokens (used by issue #362) ---
  @Prop({ type: String, default: null })
  emailVerificationToken!: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationExpires!: Date | null;

  // --- password reset tokens (used by issues #368/#369) ---
  @Prop({ type: String, default: null })
  passwordResetToken!: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpires!: Date | null;

  // --- refresh token (used by issues #364/#366/#367) ---
  @Prop({ type: String, default: null })
  refreshTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  refreshTokenExpires!: Date | null;

  @Prop({ type: Date, default: null, index: true })
  deletedAt!: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Password hashing helper — exported so it can be unit-tested without spinning up Mongo.
export const SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;
export function hashUserPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// Pre-save hook — hash the password whenever it is set or modified.
UserSchema.pre<UserDocument>('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    this.password = await hashUserPassword(this.password);
    return next();
  } catch (err) {
    return next(err as Error);
  }
});

// Instance method — compare a candidate plaintext password against the stored hash.
UserSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Automatically exclude soft-deleted documents from all query operations.
function excludeDeleted(this: Query<unknown, UserDocument>, next: () => void): void {
  const filter = this.getFilter();
  if (!('deletedAt' in filter)) {
    this.where({ deletedAt: null });
  }
  next();
}

UserSchema.pre('find', excludeDeleted);
UserSchema.pre('findOne', excludeDeleted);
UserSchema.pre('countDocuments', excludeDeleted);
UserSchema.pre('findOneAndUpdate', excludeDeleted);
