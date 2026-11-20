import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { analyticsEventSchema } from './analytics.schemas';
import type { AnalyticsEvent } from './analytics.schemas';
import { ANALYTICS_EVENT_STORE } from './analytics.tokens';

export interface AnalyticsEventStore {
  record(event: AnalyticsEvent): Promise<void>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Optional()
    @Inject(ANALYTICS_EVENT_STORE)
    private readonly eventStore?: AnalyticsEventStore,
  ) {}

  async ingest(input: unknown): Promise<AnalyticsEvent> {
    const result = analyticsEventSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid analytics event.',
        issues: result.error.issues,
      });
    }

    if (!this.eventStore) {
      throw new ServiceUnavailableException(
        'Analytics event storage is not configured.',
      );
    }

    await this.eventStore.record(result.data);
    return result.data;
  }
}
