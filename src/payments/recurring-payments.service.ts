import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRecurringPaymentDto {
  commissionId: string;
  amountUsdc: number;
  assetCode: string;
  clientWallet: string;
  intervalDays: number;
  maxOccurrences?: number;
}

@Injectable()
export class RecurringPaymentsService {
  private readonly logger = new Logger(RecurringPaymentsService.name);
  // In-memory store — replace with DB table in production
  private subscriptions = new Map<string, {
    id: string; commissionId: string; amountUsdc: number; assetCode: string;
    clientWallet: string; intervalDays: number; maxOccurrences?: number;
    occurrenceCount: number; nextRunAt: Date; active: boolean; createdAt: Date;
  }>();

  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateRecurringPaymentDto) {
    const id = `rec_${Date.now()}`;
    const sub = { id, ...dto, occurrenceCount: 0, active: true, createdAt: new Date(),
      nextRunAt: new Date(Date.now() + dto.intervalDays * 86400000) };
    this.subscriptions.set(id, sub);
    this.logger.log(`Recurring payment created — id=${id} interval=${dto.intervalDays}d`);
    return sub;
  }

  cancel(id: string) {
    const sub = this.subscriptions.get(id);
    if (!sub) throw new NotFoundException(`Subscription ${id} not found`);
    sub.active = false;
    this.logger.log(`Recurring payment cancelled — id=${id}`);
    return { id, cancelled: true };
  }

  list() { return [...this.subscriptions.values()].filter((s) => s.active); }

  @Cron(CronExpression.EVERY_HOUR)
  async processDueSubscriptions() {
    const now = new Date();
    let processed = 0;
    for (const sub of this.subscriptions.values()) {
      if (!sub.active || sub.nextRunAt > now) continue;
      if (sub.maxOccurrences && sub.occurrenceCount >= sub.maxOccurrences) { sub.active = false; continue; }
      sub.occurrenceCount++;
      sub.nextRunAt = new Date(now.getTime() + sub.intervalDays * 86400000);
      processed++;
      this.logger.log(`Recurring payment triggered — id=${sub.id} occurrence=${sub.occurrenceCount}`);
    }
    return { processed };
  }
}
