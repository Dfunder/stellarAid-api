/**
 * Zod validation schemas for analytics events and per-event-type `properties`.
 *
 * Every analytics event type has a dedicated property schema so ingested
 * analytics records conform to a predictable, queryable structure while
 * also rejecting any keys that resemble PII or wallet secrets.
 */

import { z } from 'zod';

export const ANALYTICS_EVENT_TYPES = [
  'PAGE_VIEW',
  'ARTWORK_VIEW',
  'SAVE',
  'PURCHASE_START',
  'PURCHASE_COMPLETE',
  'COMMISSION_REQUEST',
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const ANALYTICS_ASSETS = ['XLM', 'USDC', 'EURC'] as const;
export type AnalyticsAsset = (typeof ANALYTICS_ASSETS)[number];

export const ARTWORK_VIEW_SOURCES = [
  'marketplace',
  'search',
  'profile',
  'featured',
  'trending',
  'recommended',
  'direct',
] as const;

const PII_PROPERTY_KEYS = new Set([
  'email',
  'password',
  'phone',
  'phonenumber',
  'ssn',
  'address',
  'fullname',
  'creditcard',
  'cardnumber',
  'dob',
  'dateofbirth',
  'secretkey',
  'privatekey',
]);

/**
 * Recursively checks an object for any property key matching the PII denylist.
 */
export function findPiiPropertyKey(value: unknown): string | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPiiPropertyKey(item);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }

  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[_-\s]/g, '');
    if (PII_PROPERTY_KEYS.has(normalizedKey)) {
      return key;
    }
    const nestedFound = findPiiPropertyKey(nested);
    if (nestedFound !== null) {
      return nestedFound;
    }
  }
  return null;
}

const nonEmptyIdSchema = z.string().trim().min(1).max(128);

export const pageViewPropertiesSchema = z
  .object({
    path: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^\//, 'path must start with "/".'),
    referrer: z.string().trim().max(1024).optional(),
    durationMs: z.number().int().min(0).optional(),
    utmSource: z.string().trim().min(1).max(120).optional(),
    utmMedium: z.string().trim().min(1).max(120).optional(),
    utmCampaign: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const artworkViewPropertiesSchema = z
  .object({
    artworkId: nonEmptyIdSchema,
    artistId: nonEmptyIdSchema.optional(),
    category: z.string().trim().min(1).max(64).optional(),
    source: z.enum(ARTWORK_VIEW_SOURCES).optional(),
  })
  .strict();

export const savePropertiesSchema = z
  .object({
    artworkId: nonEmptyIdSchema,
    action: z.enum(['save', 'unsave']).default('save'),
    collectionId: nonEmptyIdSchema.optional(),
  })
  .strict();

export const purchaseStartPropertiesSchema = z
  .object({
    artworkId: nonEmptyIdSchema,
    orderId: nonEmptyIdSchema.optional(),
    amount: z.number().positive(),
    asset: z.enum(ANALYTICS_ASSETS),
  })
  .strict();

export const purchaseCompletePropertiesSchema = z
  .object({
    artworkId: nonEmptyIdSchema,
    orderId: nonEmptyIdSchema,
    amount: z.number().positive(),
    asset: z.enum(ANALYTICS_ASSETS),
    transactionHash: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export const commissionRequestPropertiesSchema = z
  .object({
    commissionId: nonEmptyIdSchema,
    artistId: nonEmptyIdSchema,
    budget: z.number().positive().optional(),
    asset: z.enum(ANALYTICS_ASSETS).optional(),
  })
  .strict();

export const ANALYTICS_EVENT_PROPERTY_SCHEMAS = {
  PAGE_VIEW: pageViewPropertiesSchema,
  ARTWORK_VIEW: artworkViewPropertiesSchema,
  SAVE: savePropertiesSchema,
  PURCHASE_START: purchaseStartPropertiesSchema,
  PURCHASE_COMPLETE: purchaseCompletePropertiesSchema,
  COMMISSION_REQUEST: commissionRequestPropertiesSchema,
} as const;

export interface AnalyticsEventPropertiesMap {
  PAGE_VIEW: z.infer<typeof pageViewPropertiesSchema>;
  ARTWORK_VIEW: z.infer<typeof artworkViewPropertiesSchema>;
  SAVE: z.infer<typeof savePropertiesSchema>;
  PURCHASE_START: z.infer<typeof purchaseStartPropertiesSchema>;
  PURCHASE_COMPLETE: z.infer<typeof purchaseCompletePropertiesSchema>;
  COMMISSION_REQUEST: z.infer<typeof commissionRequestPropertiesSchema>;
}

export type AnyAnalyticsEventProperties =
  AnalyticsEventPropertiesMap[AnalyticsEventType];

export interface AnalyticsValidationIssue {
  readonly eventIndex?: number;
  readonly eventType?: string;
  readonly path: string;
  readonly message: string;
}

export class AnalyticsValidationError extends Error {
  readonly issues: readonly AnalyticsValidationIssue[];

  constructor(issues: readonly AnalyticsValidationIssue[]) {
    const summary = issues
      .map((issue) => {
        const prefix =
          issue.eventIndex !== undefined ? `events[${issue.eventIndex}]` : '';
        const typeTag = issue.eventType ? `(${issue.eventType})` : '';
        const pathPart = issue.path ? `.${issue.path}` : '';
        return `${prefix}${typeTag}${pathPart}: ${issue.message}`;
      })
      .join('; ');
    super(`Analytics event validation failed: ${summary}`);
    this.name = 'AnalyticsValidationError';
    this.issues = issues;
  }
}

/**
 * Validates `properties` for a specific `AnalyticsEventType` and returns the
 * parsed, typed properties object. Throws `AnalyticsValidationError` on failure.
 */
export function validateEventProperties<T extends AnalyticsEventType>(
  type: T,
  properties: unknown,
  eventIndex?: number,
): AnalyticsEventPropertiesMap[T] {
  if (!ANALYTICS_EVENT_TYPES.includes(type)) {
    throw new AnalyticsValidationError([
      {
        eventIndex,
        eventType: String(type),
        path: 'type',
        message: `Unsupported analytics event type: ${String(type)}`,
      },
    ]);
  }

  const piiKey = findPiiPropertyKey(properties);
  if (piiKey !== null) {
    throw new AnalyticsValidationError([
      {
        eventIndex,
        eventType: type,
        path: `properties.${piiKey}`,
        message: `properties must not contain PII or secret fields ("${piiKey}").`,
      },
    ]);
  }

  const schema = ANALYTICS_EVENT_PROPERTY_SCHEMAS[type];
  const result = schema.safeParse(properties ?? {});
  if (!result.success) {
    const issues: AnalyticsValidationIssue[] = result.error.issues.map(
      (issue) => ({
        eventIndex,
        eventType: type,
        path: ['properties', ...issue.path.map(String)].join('.'),
        message: issue.message,
      }),
    );
    throw new AnalyticsValidationError(issues);
  }

  return result.data as AnalyticsEventPropertiesMap[T];
}

export const analyticsEventSchema = z
  .object({
    type: z.enum(ANALYTICS_EVENT_TYPES),
    userId: z.string().trim().min(1).max(128).optional(),
    properties: z.record(z.string(), z.unknown()),
    timestamp: z.coerce.date().optional(),
  })
  .superRefine((event, ctx) => {
    const piiKey = findPiiPropertyKey(event.properties);
    if (piiKey !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['properties', piiKey],
        message: `properties must not contain PII or secret fields ("${piiKey}").`,
      });
      return;
    }

    const schema = ANALYTICS_EVENT_PROPERTY_SCHEMAS[event.type];
    const parsed = schema.safeParse(event.properties);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: ['properties', ...issue.path],
          message: issue.message,
        });
      }
    }
  });

export const analyticsEventBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(100),
});

export type AnalyticsEventBatchSchema = z.infer<
  typeof analyticsEventBatchSchema
>;
