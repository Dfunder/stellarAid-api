/**
 * Analytics event ingestion service with strict per-event-type Zod validation.
 *
 * Every incoming analytics event is validated against its event-type-specific
 * property schema (`src/validators/analytics.schemas.ts`) and checked for PII
 * fields at ingestion before any persistence call is made.
 */

import {
  AnalyticsValidationError,
  validateEventProperties,
  type AnalyticsEventType,
  type AnalyticsValidationIssue,
  type AnyAnalyticsEventProperties,
} from '../validators/analytics.schemas';

export {
  AnalyticsValidationError,
  validateEventProperties,
  type AnalyticsEventType,
  type AnalyticsValidationIssue,
  type AnyAnalyticsEventProperties,
};

export interface AnalyticsEventInput {
  readonly type: AnalyticsEventType;
  readonly userId?: string;
  readonly properties?: Record<string, unknown>;
  readonly timestamp?: Date;
}

export interface PersistedAnalyticsEventRecord {
  readonly type: AnalyticsEventType;
  readonly userId?: string;
  readonly properties: AnyAnalyticsEventProperties;
  readonly createdAt: Date;
}

export interface AnalyticsEventRepository {
  createMany(args: {
    data: readonly PersistedAnalyticsEventRecord[];
  }): Promise<{ count: number } | unknown>;
}

export interface RecordEventsResult {
  readonly accepted: number;
  readonly events: readonly PersistedAnalyticsEventRecord[];
}

let activeAnalyticsRepository: AnalyticsEventRepository | undefined;

/**
 * Registers or clears the persistence repository (e.g., `prisma.analyticsEvent`)
 * used by `recordAnalyticsEvents`.
 */
export function setAnalyticsEventRepository(
  repository: AnalyticsEventRepository | undefined,
): void {
  activeAnalyticsRepository = repository;
}

/**
 * Validates a single `AnalyticsEventInput` and returns a normalized
 * `PersistedAnalyticsEventRecord`.
 */
export function validateAnalyticsEvent(
  event: AnalyticsEventInput,
  index?: number,
): PersistedAnalyticsEventRecord {
  const issues: AnalyticsValidationIssue[] = [];

  if (event.userId !== undefined && event.userId.trim().length === 0) {
    issues.push({
      eventIndex: index,
      eventType: event.type,
      path: 'userId',
      message: 'userId must be a non-empty string when provided.',
    });
  }

  if (
    event.timestamp !== undefined &&
    (!(event.timestamp instanceof Date) ||
      Number.isNaN(event.timestamp.getTime()))
  ) {
    issues.push({
      eventIndex: index,
      eventType: event.type,
      path: 'timestamp',
      message: 'timestamp must be a valid Date instance when provided.',
    });
  }

  let validatedProperties: AnyAnalyticsEventProperties | undefined;
  try {
    validatedProperties = validateEventProperties(
      event.type,
      event.properties,
      index,
    );
  } catch (err) {
    if (err instanceof AnalyticsValidationError) {
      issues.push(...err.issues);
    } else {
      throw err;
    }
  }

  if (issues.length > 0 || validatedProperties === undefined) {
    throw new AnalyticsValidationError(issues);
  }

  return {
    type: event.type,
    ...(event.userId !== undefined ? { userId: event.userId.trim() } : {}),
    properties: validatedProperties,
    createdAt: event.timestamp ?? new Date(),
  };
}

/**
 * Validates all incoming analytics events at ingestion and persists them
 * atomically via the configured repository.
 *
 * If any event in the batch fails schema or PII validation, throws an
 * `AnalyticsValidationError` containing all collected issues and performs no
 * database writes.
 */
export async function recordAnalyticsEvents(
  events: readonly AnalyticsEventInput[],
): Promise<RecordEventsResult> {
  if (events.length === 0) {
    return { accepted: 0, events: [] };
  }

  const allIssues: AnalyticsValidationIssue[] = [];
  const validatedRecords: PersistedAnalyticsEventRecord[] = [];

  events.forEach((event, index) => {
    try {
      validatedRecords.push(validateAnalyticsEvent(event, index));
    } catch (err) {
      if (err instanceof AnalyticsValidationError) {
        allIssues.push(...err.issues);
      } else {
        throw err;
      }
    }
  });

  if (allIssues.length > 0) {
    throw new AnalyticsValidationError(allIssues);
  }

  if (activeAnalyticsRepository !== undefined) {
    await activeAnalyticsRepository.createMany({
      data: validatedRecords,
    });
  }

  return {
    accepted: validatedRecords.length,
    events: validatedRecords,
  };
}
