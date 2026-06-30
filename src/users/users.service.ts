import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  role?: string;
  walletAddress?: string | null;
}

/**
 * Thin CRUD layer over the User Mongoose model. Auth and account
 * services in downstream PRs read/write the user through this service
 * so the User module owns all query semantics.
 */
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findByVerificationToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ emailVerificationToken: token }).exec();
  }

  /**
   * Look up a user by their active password-reset token digest.
   *
   * Callers MUST pass the hashed token (see `hashResetToken` in
   * `auth.service.ts`) rather than the raw token, so a leaked DB cannot
   * be used to complete a reset. Expiry is enforced by the caller.
   */
  async findByPasswordResetToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ passwordResetToken: token }).exec();
  }

  async create(input: CreateUserInput): Promise<UserDocument> {
    const created = await this.userModel.create({
      ...input,
      email: input.email.toLowerCase().trim(),
    });
    return created;
  }

  async update(id: string, updates: Partial<User>): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async updateByEmail(email: string, updates: Partial<User>): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate({ email: email.toLowerCase().trim() }, updates, { new: true })
      .exec();
  }
}
