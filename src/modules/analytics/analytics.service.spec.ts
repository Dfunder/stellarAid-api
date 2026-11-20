import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsEventStore } from './analytics.service';

describe('AnalyticsService', () => {
  it('rejects invalid properties before checking for a storage provider', async () => {
    const service = new AnalyticsService();

    await expect(
      service.ingest({
        type: 'campaign_created',
        properties: { campaignId: '', unexpected: true },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists and returns a validated event', async () => {
    const store: AnalyticsEventStore = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new AnalyticsService(store);
    const event = {
      type: 'donation_completed',
      properties: {
        campaignId: 'campaign-1',
        amount: '12.50',
        assetCode: 'USDC',
        transactionHash: 'abc123',
      },
    } as const;

    await expect(service.ingest(event)).resolves.toEqual(event);
    expect(store.record).toHaveBeenCalledWith(event);
  });

  it('does not silently accept valid events without storage configured', async () => {
    const service = new AnalyticsService();

    await expect(
      service.ingest({
        type: 'user_signed_up',
        properties: { method: 'email' },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
