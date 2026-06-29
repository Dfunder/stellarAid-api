import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole, UserStatus } from '../users/schemas/user.schema';
import { Kyc, KycDocument, KycReviewStatus } from '../kyc/schemas/kyc.schema';
import { MailService } from '../mail/mail.service';
import { KycStatus } from '../users/schemas/user.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Kyc.name) private readonly kycModel: Model<KycDocument>,
    private readonly mailService: MailService,
  ) {}

  async softDelete(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    user.deletedAt = new Date();
    await user.save();
  }

  // #386
  async updateRole(userId: string, role: UserRole, requesterId: string): Promise<UserDocument> {
    if (userId === requesterId) throw new ForbiddenException('Admins cannot change their own role');
    const user = await this.userModel.findByIdAndUpdate(userId, { role }, { new: true }).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // #391
  async updateStatus(userId: string, status: UserStatus, requesterId: string): Promise<UserDocument> {
    if (userId === requesterId) throw new ForbiddenException('Admins cannot change their own status');
    const user = await this.userModel.findByIdAndUpdate(userId, { status }, { new: true }).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // #392
  async reviewKyc(kycId: string, status: KycReviewStatus.APPROVED | KycReviewStatus.REJECTED, reviewNote?: string): Promise<KycDocument> {
    const kyc = await this.kycModel.findByIdAndUpdate(
      kycId,
      { status, reviewNote: reviewNote ?? null, reviewedAt: new Date() },
      { new: true },
    ).exec();
    if (!kyc) throw new NotFoundException('KYC submission not found');

    const kycStatus = status === KycReviewStatus.APPROVED ? KycStatus.APPROVED : KycStatus.REJECTED;
    const user = await this.userModel.findByIdAndUpdate(kyc.userId, { kycStatus }, { new: true }).exec();

    if (user) {
      const decision = status === KycReviewStatus.APPROVED ? 'approved' : 'rejected';
      await this.mailService.sendEmail({
        to: user.email,
        subject: `Your KYC submission has been ${decision}`,
        html: `<p>Hi ${user.fullName},</p><p>Your KYC submission has been <strong>${decision}</strong>.${reviewNote ? ` Note: ${reviewNote}` : ''}</p>`,
      });
    }

    return kyc;
  }

  // #393
  async listKyc(status?: KycReviewStatus): Promise<Array<{ kyc: KycDocument; user: Partial<UserDocument> | null }>> {
    const filter = status ? { status } : {};
    const submissions = await this.kycModel.find(filter).sort({ submittedAt: -1 }).exec();

    return Promise.all(
      submissions.map(async (kyc) => {
        const user = await this.userModel.findById(kyc.userId).select('fullName email kycStatus').exec();
        return { kyc, user };
      }),
    );
  }
}
