import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StellarTransactionsService } from '../stellar/stellar-transactions.service';
import { HorizonService } from '../stellar/horizon.service';
import { BrowseCampaignsQueryDto, BrowseCampaignsResponseDto } from './dto/browse-campaigns.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ContractBalanceResponseDto } from './dto/contract-balance.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellarTransactions: StellarTransactionsService,
    private readonly horizonService: HorizonService,
  ) {}

  async createCampaign(userId: string, dto: CreateCampaignDto) {
    if (dto.walletAddress) {
      const exists = await this.horizonService.accountExists(dto.walletAddress);
      if (!exists) {
        throw new BadRequestException(
          `Stellar account ${dto.walletAddress} does not exist or is not funded`,
        );
      }
    }

    const milestoneCreates = (dto.milestones || [])
      .filter((m) => m.targetAmount != null)
      .map((m) => ({
        title: m.title,
        description: m.description ?? null,
        targetAmount: m.targetAmount!,
        dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
      }));

    const acceptedAssets = parseAcceptedAssets(dto.acceptedAssets);

    return this.prisma.campaign.create({
      data: {
        title: dto.title,
        description: dto.description ?? dto.story ?? '',
        story: dto.story ?? null,
        imageUrl: dto.coverImageUrl ?? undefined,
        category: dto.category ?? undefined,
        goalAmount: dto.goalAmount ?? 0,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: 'PENDING_APPROVAL',
        creatorId: userId,
        contractId: dto.contractId ?? undefined,
        acceptedAssets: acceptedAssets.length > 0 ? acceptedAssets : undefined,
        milestones:
          milestoneCreates.length > 0 ? { create: milestoneCreates } : undefined,
      },
      include: { milestones: true },
    });
  }

  async updateCampaign(userId: string, campaignId: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        title: dto.title ?? campaign.title,
        description: dto.description ?? dto.story ?? campaign.description,
        story: dto.story ?? campaign.story,
        imageUrl: dto.coverImageUrl ?? campaign.imageUrl,
      },
    });

    return updated;
  }

  /**
   * Browse public campaigns with pagination, filtering, and sorting
   * Excludes DRAFT campaigns from public listing
   */
  async browseCampaigns(
    query: BrowseCampaignsQueryDto,
  ): Promise<BrowseCampaignsResponseDto> {
    const { page, limit, category, status, search, sortBy } = query;
    const skip = (page - 1) * limit;

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      if (trimmedSearch.length < 3) {
        throw new BadRequestException('Search must be at least 3 characters');
      }
      return this.browseCampaignsWithFullTextSearch({
        page,
        limit,
        skip,
        category,
        status,
        search: trimmedSearch,
      });
    }

    const where: Prisma.CampaignWhereInput = {
      status: { not: 'DRAFT' },
    };

    if (category) {
      where.category = {
        equals: category,
        mode: 'insensitive',
      };
    }

    if (status) {
      where.status = status as any;
    }

    let orderBy: Prisma.CampaignOrderByWithRelationInput | Prisma.CampaignOrderByWithRelationInput[];
    switch (sortBy) {
      case 'mostFunded':
        orderBy = { raisedAmount: 'desc' };
        break;
      case 'endingSoon':
        orderBy = { endDate: 'asc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      default:
        orderBy = [{ performanceScore: 'desc' }, { createdAt: 'desc' }];
    }

    const [total, campaigns] = await this.prisma.$transaction([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        select: campaignBrowseSelect(),
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return { data: campaigns, total, page, limit };
  }

  async getFeaturedCampaigns() {
    return this.prisma.campaign.findMany({
      where: {
        isFeatured: true,
        status: { not: 'DRAFT' },
      },
      select: campaignBrowseSelect(),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 6,
    });
  }

  async featureCampaign(campaignId: string) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
      });
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      if (campaign.isFeatured) {
        return campaign;
      }

      const featuredCount = await tx.campaign.count({
        where: { isFeatured: true },
      });
      if (featuredCount >= 6) {
        throw new BadRequestException('Maximum 6 featured campaigns allowed');
      }

      return tx.campaign.update({
        where: { id: campaignId },
        data: { isFeatured: true },
      });
    });
  }

  async getContractBalance(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (!campaign.contractId) {
      throw new BadRequestException('Campaign has no contractId set');
    }

    const balances = await this.stellarTransactions.getContractBalances(campaign.contractId);

    // Calculate total on-chain balance
    let onChainTotal = 0;
    for (const b of balances) {
      onChainTotal += parseFloat(b.balance);
    }

    const storedRaisedAmount = parseFloat(campaign.raisedAmount.toString());
    const discrepancyDetected = Math.abs(onChainTotal - storedRaisedAmount) > 0.0001;

    // If discrepancy detected, update the stored raisedAmount
    if (discrepancyDetected) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          raisedAmount: onChainTotal,
        },
      });
    }

    return {
      contractId: campaign.contractId,
      balances,
      storedRaisedAmount: campaign.raisedAmount.toString(),
      onChainTotal: onChainTotal.toString(),
      discrepancyDetected,
    };
  }

  async recalculateCampaignStats(campaignId: string) {
    const agg = await this.prisma.donation.aggregate({
      where: {
        campaignId,
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
    });

    const raisedAmount = agg._sum.amount ?? 0;

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { raisedAmount },
    });
  }

  /**
   * GET /campaigns/:id/updates
   * Returns paginated updates sorted by createdAt DESC (10 per page).
   */
  async getCampaignUpdates(campaignId: string, page = 1) {
    const limit = 10;
    const skip = (page - 1) * limit;

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const [total, updates] = await this.prisma.$transaction([
      this.prisma.update.count({ where: { campaignId } }),
      this.prisma.update.findMany({
        where: { campaignId },
        select: {
          id: true,
          title: true,
          content: true,
          imageUrls: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = updates.map((u) => ({
      ...u,
      imageUrls: Array.isArray(u.imageUrls) ? u.imageUrls : [],
    }));

    return { data, total, page, limit };
  }

  async getCampaignStats(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const donations = await this.prisma.donation.findMany({
      where: { campaignId, status: 'CONFIRMED' },
      select: { amount: true, donorId: true, assetCode: true, createdAt: true },
    });

    const totalRaised = donations.reduce((sum, d) => sum + Number(d.amount), 0);
    const donorCount = new Set(donations.map((d) => d.donorId)).size;
    const uniqueAssets = [...new Set(donations.map((d) => d.assetCode))];
    const avgDonation = donations.length ? totalRaised / donations.length : 0;

    return { campaignId, totalRaised, donorCount, uniqueAssets, avgDonation };
  }

  /**
   * GET /campaigns/:id/analytics/donations-over-time
   * Returns donation trends aggregated by day.
   */
  async getDonationsOverTime(campaignId: string, days: number = 30) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const donations = await this.prisma.donation.groupBy({
      where: {
        campaignId,
        status: 'CONFIRMED',
        donatedAt: { gte: startDate },
      },
      by: ['donatedAt'],
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { donatedAt: 'asc' },
    });

    const result: { date: string; donationCount: number; totalAmount: number }[] = [];
    const aggregated = new Map<string, { count: number; total: number }>();

    for (const donation of donations) {
      const dateKey = new Date(donation.donatedAt).toISOString().split('T')[0];
      const existing = aggregated.get(dateKey) || { count: 0, total: 0 };
      existing.count += donation._count._all;
      existing.total += Number(donation._sum.amount ?? 0);
      aggregated.set(dateKey, existing);
    }

    const start = new Date(startDate.toISOString().split('T')[0]);
    const end = new Date();
    end.setHours(0, 0, 0, 0);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      const data = aggregated.get(dateKey) || { count: 0, total: 0 };
      result.push({
        date: dateKey,
        donationCount: data.count,
        totalAmount: data.total,
      });
    }

    return result;
  }

  /**
   * GET /campaigns/:id/analytics/asset-distribution
   * Returns donation breakdown by asset code.
   */
  async getAssetDistribution(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const donations = await this.prisma.donation.groupBy({
      where: { campaignId, status: 'CONFIRMED' },
      by: ['assetCode'],
      _count: { _all: true },
      _sum: { amount: true },
    });

    return donations.map((d) => ({
      asset: d.assetCode,
      donationCount: d._count._all,
      totalAmount: Number(d._sum.amount ?? 0),
    }));
  }

  private async browseCampaignsWithFullTextSearch(input: {
    page: number;
    limit: number;
    skip: number;
    category?: string;
    status?: string;
    search: string;
  }): Promise<BrowseCampaignsResponseDto> {
    const { page, limit, skip, category, status, search } = input;

    const filters = sqlCampaignFilters({ category, status });

    const [countRow, rankedRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ count: number }[]>`        SELECT COUNT(*)::int AS count
        FROM campaigns c
        WHERE ${filters.whereSql}
          AND to_tsvector('english',
            coalesce(c.title, '') || ' ' || coalesce(c.description, '') || ' ' || coalesce(c.story, '')
          ) @@ plainto_tsquery('english', ${search})
      `,
      this.prisma.$queryRaw<{ id: string; rank: number }[]>`        SELECT c.id,
          ts_rank(
            to_tsvector('english',
              coalesce(c.title, '') || ' ' || coalesce(c.description, '') || ' ' || coalesce(c.story, '')
            ),
            plainto_tsquery('english', ${search})
          ) AS rank
        FROM campaigns c
        WHERE ${filters.whereSql}
          AND to_tsvector('english',
            coalesce(c.title, '') || ' ' || coalesce(c.description, '') || ' ' || coalesce(c.story, '')
          ) @@ plainto_tsquery('english', ${search})
        ORDER BY rank DESC, c."createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
    ]);

    const total = countRow[0]?.count ?? 0;
    const ids = rankedRows.map((r) => r.id);
    if (ids.length === 0) {
      return { data: [], total, page, limit };
    }

    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: ids } },
      select: campaignBrowseSelect(),
    });

    const byId = new Map(campaigns.map((c) => [c.id, c]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as any[];

    return { data: ordered, total, page, limit };
  }

  async createUpdate(campaignId: string, userId: string, dto: { title: string; content: string; imageUrls?: string[] }) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);
    if (campaign.creatorId !== userId) throw new BadRequestException('Not authorized to update this campaign');

    return this.prisma.update.create({
      data: {
        campaignId,
        creatorId: userId,
        title: dto.title,
        content: dto.content,
        imageUrls: dto.imageUrls ?? [],
      },
    });
  }

  async deleteUpdate(campaignId: string, updateId: string, userId: string, isAdmin: boolean) {
    const update = await this.prisma.update.findFirst({ where: { id: updateId, campaignId } });
    if (!update) throw new NotFoundException(`Update ${updateId} not found`);
    if (!isAdmin && update.creatorId !== userId) throw new BadRequestException('Not authorized');

    await this.prisma.update.update({
      where: { id: updateId },
      data: { deletedAt: new Date() },
    });
  }
}

function campaignBrowseSelect() {
  return {
    id: true,
    title: true,
    description: true,
    story: true,
    goalAmount: true,
    raisedAmount: true,
    status: true,
    creatorId: true,
    startDate: true,
    endDate: true,
    imageUrl: true,
    category: true,
    performanceScore: true,
    isFeatured: true,
    createdAt: true,
    updatedAt: true,
    creator: {
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        walletAddress: true,
      },
    },
    _count: {
      select: {
        donations: true,
        milestones: true,
      },
    },
  } satisfies Prisma.CampaignSelect;
}

function parseAcceptedAssets(values?: string[]) {
  if (!values || values.length === 0) return [];

  return values
    .map((v) => String(v).trim())
    .filter(Boolean)
    .map((v) => {
      if (v.toUpperCase() === 'XLM') {
        return { assetType: 'native' as const };
      }
      const [code, issuer] = v.split(':');
      if (!code || !issuer) return null;
      return { assetType: 'credit' as const, code, issuer };
    })
    .filter(Boolean) as Array<
    | { assetType: 'native' }
    | { assetType: 'credit'; code: string; issuer: string }
  >;
}

function sqlCampaignFilters(input: { category?: string; status?: string }) {
  const whereParts: Prisma.Sql[] = [Prisma.sql`c.status <> 'DRAFT'`];

  if (input.status) {
    whereParts.push(Prisma.sql`c.status = ${input.status}`);
  }

  if (input.category) {
    whereParts.push(Prisma.sql`c.category ILIKE ${input.category}`);
  }

  const whereSql =
    whereParts.length === 1
      ? whereParts[0]
      : Prisma.sql`${Prisma.join(whereParts, ' AND ')}`;

  return { whereSql };
}
