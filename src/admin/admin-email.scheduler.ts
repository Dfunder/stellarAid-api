import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { ConfigService } from '@nestjs/config';

interface DailyPlatformMetrics {
  newCampaigns: number;
  newUsers: number;
  totalDonations: number;
  xlmVolume: string;
}

@Injectable()
export class AdminEmailScheduler {
  private readonly logger = new Logger(AdminEmailScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 8 * * *') // Daily at 8:00 UTC
  async sendDailySummary(): Promise<void> {
    try {
      const adminEmails = this.config.get<string>('ADMIN_EMAILS', '');
      if (!adminEmails) {
        this.logger.debug('No admin emails configured, skipping daily summary');
        return;
      }

      const metrics = await this.get24HourMetrics();

      const adminEmailList = adminEmails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

      for (const toEmail of adminEmailList) {
        const subject = `Daily Platform Summary - ${new Date().toISOString().split('T')[0]}`;
        const html = this.renderSummaryEmail(metrics);

        await this.emailService.send({ to: toEmail, subject, html, unsubscribeUrl: `skip` });
        this.logger.log(`Sent daily summary to ${toEmail}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send daily summary: ${(error as Error).message}`);
    }
  }

  private async get24HourMetrics(): Promise<DailyPlatformMetrics> {
    const since = new Date();
    since.setDate(since.getDate() - 1);

    const [newCampaigns, newUsers, donationAgg] = await this.prisma.$transaction([
      this.prisma.campaign.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.donation.aggregate({
        where: {
          status: 'CONFIRMED',
          donatedAt: { gte: since },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      newCampaigns,
      newUsers,
      totalDonations: donationAgg._count._all,
      xlmVolume: donationAgg._sum.amount?.toString() ?? '0',
    };
  }

  private renderSummaryEmail(metrics: DailyPlatformMetrics): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <h1 style="color:#3b82f6;font-size:24px;margin-bottom:24px">Daily Platform Summary</h1>
  <table style="width:100%;border-collapse:collapse">
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:12px 0;font-weight:bold">New Campaigns (24h)</td>
      <td style="padding:12px 0;text-align:right">${metrics.newCampaigns}</td>
    </tr>
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:12px 0;font-weight:bold">New Users (24h)</td>
      <td style="padding:12px 0;text-align:right">${metrics.newUsers}</td>
    </tr>
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:12px 0;font-weight:bold">Total Donations (24h)</td>
      <td style="padding:12px 0;text-align:right">${metrics.totalDonations}</td>
    </tr>
    <tr>
      <td style="padding:12px 0;font-weight:bold">XLM Volume (24h)</td>
      <td style="padding:12px 0;text-align:right">${Number(metrics.xlmVolume).toFixed(2)} XLM</td>
    </tr>
  </table>
</body>
</html>`;
  }
}