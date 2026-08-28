import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionStatus } from '@prisma/client';

export interface OpenDisputeDto { commissionId: string; reason: string; evidenceUrls?: string[]; }

@Injectable()
export class PaymentDisputesService {
  private readonly logger = new Logger(PaymentDisputesService.name);
  constructor(private readonly prisma: PrismaService) {}

  async openDispute(clientId: string, dto: OpenDisputeDto) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: dto.commissionId },
      include: { artist: { include: { user: true } } },
    });
    if (!commission) throw new NotFoundException(`Commission ${dto.commissionId} not found`);
    if (commission.clientId !== clientId) throw new BadRequestException('Not your commission');
    if (commission.status === CommissionStatus.DISPUTED) throw new BadRequestException('Dispute already open');

    await this.prisma.commission.update({ where: { id: dto.commissionId }, data: { status: CommissionStatus.DISPUTED } });
    this.logger.log(`Dispute opened — commissionId=${dto.commissionId} clientId=${clientId}`);

    // Notify artist
    if (commission.artist.userId) {
      await this.prisma.notification.create({ data: {
        userId: commission.artist.userId, type: 'DISPUTE_OPENED', title: 'Dispute Opened',
        message: `A dispute has been opened on commission "${commission.title}": ${dto.reason}`,
        metadata: { commissionId: dto.commissionId, reason: dto.reason, evidenceUrls: dto.evidenceUrls },
      }});
    }

    return { commissionId: dto.commissionId, status: 'DISPUTED', reason: dto.reason };
  }

  async getDisputeDetails(commissionId: string) {
    const commission = await this.prisma.commission.findUnique({
      where: { id: commissionId, status: CommissionStatus.DISPUTED },
      include: { client: { select: { id: true, name: true, email: true } },
        artist: { include: { user: { select: { id: true, name: true } } } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!commission) throw new NotFoundException('Disputed commission not found');
    return commission;
  }
}
