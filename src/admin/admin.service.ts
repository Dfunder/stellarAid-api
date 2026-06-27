import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SuspendCampaignDto } from './dtos/suspend-campaign.dto';
import { RejectCampaignDto } from './dtos/reject-campaign.dto';
import { FileDisputeDto } from './dtos/file-dispute.dto';
import { SuspendUserDto } from './dtos/suspend-user.dto';
import { ListDisputesDto } from './dtos/list-disputes.dto';
import { ResolveDisputeDto } from './dtos/resolve-dispute.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Issue #308: suspend user ──────────────────────────────────────────────

  async suspendUser(
    userId: string,
    dto: SuspendUserDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.isSuspended) throw new BadRequestException('User is already suspended');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isSuspended: true, suspensionReason: dto.reason, isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_SUSPENDED',
        resourceType: 'User',
        resourceId: userId,
        details: JSON.stringify({ reason: dto.reason }),
      },
    });

    if (user.email) {
      await this.notificationsService.sendUserSuspensionEmail(user.email, true, dto.reason);
    }

    return { message: `User ${userId} has been suspended` };
  }

  async unsuspendUser(userId: string, adminId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (!user.isSuspended) throw new BadRequestException('User is not suspended');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isSuspended: false, suspensionReason: null, isActive: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_UNSUSPENDED',
        resourceType: 'User',
        resourceId: userId,
        details: null,
      },
    });

    if (user.email) {
      await this.notificationsService.sendUserSuspensionEmail(user.email, false);
    }

    return { message: `User ${userId} has been unsuspended` };
  }

  // ── Issue #303: list disputes ─────────────────────────────────────────────

  async listDisputes(dto: ListDisputesDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = dto.status ? { status: dto.status as any } : {};

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          filer: { select: { id: true, walletAddress: true, email: true, displayName: true } },
          campaign: { select: { id: true, title: true } },
          donation: { select: { id: true, txHash: true, amount: true, assetCode: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      data: disputes,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ── Issue #304: resolve dispute ───────────────────────────────────────────

  async resolveDispute(
    disputeId: string,
    dto: ResolveDisputeDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        filer: { select: { email: true } },
        campaign: { select: { creatorId: true } },
      },
    });
    if (!dispute) throw new NotFoundException(`Dispute ${disputeId} not found`);
    if (dispute.status === 'RESOLVED' || dispute.status === 'REJECTED') {
      throw new BadRequestException(`Dispute is already ${dispute.status.toLowerCase()}`);
    }

    const isTerminal = dto.status === 'RESOLVED' || dto.status === 'REJECTED';
    if (isTerminal && !dto.resolution) {
      throw new BadRequestException('Resolution note is required when resolving or rejecting');
    }

    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: dto.status,
        resolution: dto.resolution ?? undefined,
        resolvedAt: isTerminal ? new Date() : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'DISPUTE_RESOLVED',
        resourceType: 'Dispute',
        resourceId: disputeId,
        details: JSON.stringify({ status: dto.status, resolution: dto.resolution }),
      },
    });

    // Notify filer
    if (dispute.filer?.email) {
      await this.notificationsService.sendDisputeResolutionEmail(
        dispute.filer.email,
        disputeId,
        dto.status,
        dto.resolution,
      );
    }

    // Notify campaign creator if terminal
    if (isTerminal && dispute.campaign?.creatorId) {
      const creator = await this.prisma.user.findUnique({
        where: { id: dispute.campaign.creatorId },
        select: { email: true },
      });
      if (creator?.email) {
        await this.notificationsService.sendDisputeResolutionEmail(
          creator.email,
          disputeId,
          dto.status,
          dto.resolution,
        );
      }
    }

    return { message: `Dispute ${disputeId} updated to ${dto.status}` };
  }

  // ── Existing: suspend campaign ────────────────────────────────────────────

  async suspendCampaign(
    campaignId: string,
    dto: SuspendCampaignDto,
    adminId: string,
    adminEmail: string,
  ): Promise<{ message: string }> {
    // 1. Fetch the campaign using Prisma
    const campaign = await this.prisma.campaign.findUnique({ 
      where: { id: campaignId } 
    });
    
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    // 2. Validate current status to prevent redundant execution
    if (campaign.status === 'SUSPENDED') {
      throw new BadRequestException('Campaign is already suspended');
    }

    const previousStatus = campaign.status;

    // 3. Update campaign status and log everything within a single transaction pipeline
    await this.prisma.$transaction(async (tx) => {
      await tx.campaign.update({
        where: { id: campaignId },
        data: { 
          status: 'SUSPENDED',
          // If your schema stores suspension reason, map it here:
          // suspensionReason: dto.reason 
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ADMIN_ACTION',
          resourceType: 'campaign',
          resourceId: campaignId,
          userId: adminId,
          details: JSON.stringify({ 
            action: 'CAMPAIGN_SUSPENDED', 
            reason: dto.reason, 
            previousStatus 
          }),
        },
      });
    });

    // 4. Dispatch background communication task
    await this.notificationsService.sendCampaignSuspensionEmail({
      toEmail: adminEmail,
      campaignId,
      campaignTitle: campaign.title,
      reason: dto.reason,
    });

    return { message: `Campaign ${campaignId} has been suspended` };
  }

  async approveCampaign(campaignId: string, adminId: string): Promise<{ message: string }> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);
    if (campaign.status !== 'PENDING_APPROVAL')
      throw new BadRequestException('Campaign is not pending review');

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'ADMIN_ACTION',
        resourceType: 'campaign',
        resourceId: campaignId,
        userId: adminId,
        details: JSON.stringify({ action: 'CAMPAIGN_APPROVED' }),
      },
    });

    return { message: `Campaign ${campaignId} approved and set to ACTIVE` };
  }

  async rejectCampaign(
    campaignId: string,
    dto: RejectCampaignDto,
    adminId: string,
  ): Promise<{ message: string }> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);
    if (campaign.status !== 'PENDING_APPROVAL')
      throw new BadRequestException('Campaign is not pending review');

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'REJECTED' },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'ADMIN_ACTION',
        resourceType: 'campaign',
        resourceId: campaignId,
        userId: adminId,
        details: JSON.stringify({ action: 'CAMPAIGN_REJECTED', reason: dto.reason }),
      },
    });

    return { message: `Campaign ${campaignId} has been rejected` };
  }

  async getPlatformStats(range: '7d' | '30d' | '90d' | 'all') {
    const since = rangeToDate(range);
    const dateFilter = since ? { gte: since } : undefined;

    const [totalUsers, totalCampaigns, donationAgg, activeCampaigns, totalContracts] =
      await Promise.all([
        this.prisma.user.count({ where: dateFilter ? { createdAt: dateFilter } : undefined }),
        this.prisma.campaign.count({ where: dateFilter ? { createdAt: dateFilter } : undefined }),
        this.prisma.donation.aggregate({
          where: {
            status: 'CONFIRMED',
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          _count: true,
          _sum: { amount: true },
        }),
        this.prisma.campaign.count({ where: { status: 'ACTIVE' } }),
        this.prisma.smartContract.count({ where: dateFilter ? { createdAt: dateFilter } : undefined }),
      ]);

    return {
      totalUsers,
      totalCampaigns,
      totalDonations: donationAgg._count,
      totalVolumeXLM: donationAgg._sum.amount?.toString() ?? '0',
      activeCampaigns,
      totalContractsDeployed: totalContracts,
    };
  }

  async getAuditLog(
    page: number,
    limit: number,
    action?: string,
    adminId?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (action) where.action = action;
    if (adminId) where.userId = adminId;

    const [total, entries] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, walletAddress: true, role: true } } },
      }),
    ]);

    return { data: entries, total, page, limit };
  }

  async fileDispute(userId: string, dto: FileDisputeDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const existingDonation = await this.prisma.donation.findFirst({
      where: { donorId: userId, campaignId: dto.campaignId, status: 'CONFIRMED' },
    });
    if (!existingDonation) throw new BadRequestException('No confirmed donation found for this campaign');

    const existing = await this.prisma.dispute.findFirst({
      where: { filerId: userId, campaignId: dto.campaignId },
    });
    if (existing) throw new ConflictException('You have already filed a dispute for this campaign');

    const dispute = await this.prisma.dispute.create({
      data: {
        donationId: existingDonation.id,
        filerId: userId,
        campaignId: dto.campaignId,
        reason: dto.reason,
        description: dto.description,
        status: 'OPENED',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'DISPUTE_FILED',
        resourceType: 'dispute',
        resourceId: dispute.id,
        userId,
        details: JSON.stringify({ campaignId: dto.campaignId, reason: dto.reason }),
      },
    });

    return dispute;
  }
}

function rangeToDate(range: '7d' | '30d' | '90d' | 'all'): Date | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
