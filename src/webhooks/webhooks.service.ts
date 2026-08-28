import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes, createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { retryWithBackoff } from '../common/utils/async.util';
import { RegisterWebhookDto, PublishWebhookEventDto } from './dto/webhook.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async register(ownerId: string, dto: RegisterWebhookDto) {
    const secret = randomBytes(32).toString('hex');
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: { ownerId, url: dto.url, events: dto.events ?? [], secret },
      select: { id: true, url: true, events: true, active: true, createdAt: true },
    });
    return { ...endpoint, secret };
  }

  list(ownerId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { ownerId },
      select: { id: true, url: true, events: true, active: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(ownerId: string, id: string) {
    const result = await this.prisma.webhookEndpoint.updateMany({
      where: { id, ownerId },
      data: { active: false },
    });
    if (result.count === 0) throw new NotFoundException('Webhook endpoint not found');
    return { deactivated: true };
  }

  async publish(ownerId: string, dto: PublishWebhookEventDto) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { ownerId, active: true },
    });
    const event = await this.prisma.webhookEvent.create({
      data: { type: dto.type, payload: dto.payload ?? {}, deliveries: { create: endpoints
        .filter((endpoint) => endpoint.events.length === 0 || endpoint.events.includes(dto.type))
        .map((endpoint) => ({ endpointId: endpoint.id })) } },
    });
    return { eventId: event.id, queued: endpoints.length };
  }

  async deliverPending(limit = 25) {
    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: { status: { in: ['PENDING', 'RETRYING'] }, nextAttemptAt: { lte: new Date() } },
      include: { endpoint: true, event: true }, take: Math.min(limit, 100), orderBy: { createdAt: 'asc' },
    });
    const results = await Promise.all(deliveries.map((delivery) => this.deliver(delivery)));
    return { processed: results.length, delivered: results.filter(Boolean).length };
  }

  private async deliver(delivery: any): Promise<boolean> {
    const body = JSON.stringify({ id: delivery.event.id, type: delivery.event.type, data: delivery.event.payload });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', delivery.endpoint.secret).update(`${timestamp}.${body}`).digest('hex');
    try {
      await retryWithBackoff(async () => {
        const response = await fetch(delivery.endpoint.url, { method: 'POST', headers: {
          'content-type': 'application/json', 'x-webhook-id': delivery.event.id,
          'x-webhook-timestamp': timestamp, 'x-webhook-signature': `v1=${signature}`,
        }, body, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
      }, { maxRetries: 3, initialDelayMs: 250 });
      await this.prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: 'DELIVERED', deliveredAt: new Date(), attempts: { increment: 1 } } });
      return true;
    } catch (error) {
      const attempts = delivery.attempts + 1;
      await this.prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: attempts >= 6 ? 'FAILED' : 'RETRYING', attempts, lastError: error instanceof Error ? error.message : 'Delivery failed', nextAttemptAt: new Date(Date.now() + Math.min(3600000, 1000 * 2 ** attempts)) } });
      this.logger.warn(`Webhook delivery ${delivery.id} failed`);
      return false;
    }
  }
}
