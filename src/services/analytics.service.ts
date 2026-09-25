/**
 * Analytics event ingestion.
 *
 * Events are trusted to already be PII-free by the time they reach here —
 * see `analytics.schemas.ts`'s `analyticsEventBatchSchema`, which rejects
 * any `properties` key that looks like PII before this is ever called.
 */

import type { AnalyticsEventType } from '@prisma/client';

import { prisma } from '@/services';

export interface AnalyticsEventInput {
  readonly type: AnalyticsEventType;
  readonly userId?: string;
  readonly properties?: Record<string, unknown>;
  readonly timestamp?: Date;
}

export interface RecordEventsResult {
  readonly accepted: number;
}

export async function recordAnalyticsEvents(
  events: readonly AnalyticsEventInput[],
): Promise<RecordEventsResult> {
  await prisma.analyticsEvent.createMany({
    data: events.map((event) => ({
      type: event.type,
      userId: event.userId,
      properties: event.properties,
      createdAt: event.timestamp ?? new Date(),
    })),
  });
  return { accepted: events.length };
}
