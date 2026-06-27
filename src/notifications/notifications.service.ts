import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_EMAIL } from '../queue/queue.constants';
import type { EmailJobData } from './email.processor';
import {
  donationReceivedTemplate,
  milestoneUnlockedTemplate,
  campaignUpdateTemplate,
} from './email-templates';

export interface SuspensionEmailPayload {
  toEmail: string;
  campaignId: string;
  campaignTitle: string;
  reason: string;
}

export interface DonationReceivedPayload {
  toEmail: string;
  userId: string;
  donorName: string;
  amount: string;
  assetCode: string;
  campaignTitle: string;
  campaignUrl: string;
}

export interface MilestoneUnlockedPayload {
  toEmail: string;
  userId: string;
  campaignTitle: string;
  milestoneTitle: string;
  campaignUrl: string;
}

export interface CampaignUpdatePayload {
  toEmail: string;
  userId: string;
  campaignTitle: string;
  updateTitle: string;
  updateContent: string;
  campaignUrl: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_EMAIL) private readonly emailQueue: Queue,
  ) {}

  /**
   * Check whether a user has enabled email notifications for a given notification type.
   * preferenceKey corresponds to keys in the preferences JSON: donationReceived, milestoneUnlocked, campaignUpdate, etc.
   */
  async shouldSendEmail(userId: string, preferenceKey: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { notificationPreference: true },
      });

      if (!user) return false;

      // If user has no email, we can't send email
      if (!user.email) return false;

      const prefs = user.notificationPreference?.preferences as Record<
        string,
        { email?: boolean; inApp?: boolean }
      > | null;

      // If no preferences set, default to true (opt-in by default)
      if (!prefs || !prefs[preferenceKey]) return true;

      return prefs[preferenceKey]?.email !== false;
    } catch (error) {
      this.logger.error(
        `Error checking notification preference ${preferenceKey} for user ${userId}: ${(error as Error).message}`,
      );
      return true; // Fail open — send the notification on error
    }
  }

  /**
   * Queue a donation received email via Bull.
   */
  async sendDonationReceivedEmail(payload: DonationReceivedPayload): Promise<void> {
    const template = donationReceivedTemplate;
    const html = template.html({
      donorName: payload.donorName,
      amount: payload.amount,
      assetCode: payload.assetCode,
      campaignTitle: payload.campaignTitle,
      campaignUrl: payload.campaignUrl,
    });

    const jobData: EmailJobData = {
      to: payload.toEmail,
      subject: template.subject,
      html,
      preferenceKey: 'donationReceived',
      userId: payload.userId,
    };

    await this.emailQueue.add('send-email', jobData);
    this.logger.log(`Queued donation received email to ${payload.toEmail}`);
  }

  /**
   * Queue a milestone unlocked email via Bull.
   */
  async sendMilestoneUnlockedEmail(payload: MilestoneUnlockedPayload): Promise<void> {
    const template = milestoneUnlockedTemplate;
    const html = template.html({
      campaignTitle: payload.campaignTitle,
      milestoneTitle: payload.milestoneTitle,
      campaignUrl: payload.campaignUrl,
    });

    const jobData: EmailJobData = {
      to: payload.toEmail,
      subject: template.subject,
      html,
      preferenceKey: 'milestoneUnlocked',
      userId: payload.userId,
    };

    await this.emailQueue.add('send-email', jobData);
    this.logger.log(`Queued milestone unlocked email to ${payload.toEmail}`);
  }

  /**
   * Queue a campaign update email via Bull.
   */
  async sendCampaignUpdateEmail(payload: CampaignUpdatePayload): Promise<void> {
    const template = campaignUpdateTemplate;
    const html = template.html({
      campaignTitle: payload.campaignTitle,
      updateTitle: payload.updateTitle,
      updateContent: payload.updateContent,
      campaignUrl: payload.campaignUrl,
    });

    const jobData: EmailJobData = {
      to: payload.toEmail,
      subject: template.subject,
      html,
      preferenceKey: 'campaignUpdate',
      userId: payload.userId,
    };

    await this.emailQueue.add('send-email', jobData);
    this.logger.log(`Queued campaign update email to ${payload.toEmail}`);
  }

  /**
   * Sends a suspension notice to the campaign creator (synchronous, not queued).
   */
  async sendCampaignSuspensionEmail(payload: SuspensionEmailPayload): Promise<void> {
    this.logger.log(
      `[EMAIL] To: ${payload.toEmail} | Subject: Your campaign "${payload.campaignTitle}" has been suspended | Reason: ${payload.reason}`,
    );
  }

  async getNotifications(userId: string, isRead?: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, ...(isRead !== undefined ? { isRead } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { updated: true };
  }

  async markOneRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) return { updated: false };
    await this.prisma.notification.update({ where: { id }, data: { isRead: true } });
    return { updated: true };
  }
  
  async sendUserSuspensionEmail(toEmail: string, suspended: boolean, reason?: string): Promise<void> {
    const subject = suspended ? 'Your account has been suspended' : 'Your account has been reinstated';
    this.logger.log(`[EMAIL] To: ${toEmail} | Subject: ${subject} | Reason: ${reason ?? 'N/A'}`);
  }

  async sendDisputeResolutionEmail(toEmail: string, disputeId: string, status: string, resolution?: string): Promise<void> {
    this.logger.log(`[EMAIL] To: ${toEmail} | Subject: Dispute ${disputeId} ${status} | Resolution: ${resolution ?? 'N/A'}`);
  }
}
