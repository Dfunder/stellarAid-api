/**
 * Analytics event validation.
 *
 * `properties` rejects any key that looks like PII (email, phone, etc.) —
 * a denylist, not a guarantee of privacy, but it catches the obvious
 * mistakes at the boundary rather than leaving it to callers to remember.
 */

import { z } from 'zod';
import { uuidSchema } from './common.schemas';

const ANALYTICS_EVENT_TYPES = [
  'PAGE_VIEW',
  'ARTWORK_VIEW',
  'SAVE',
  'PURCHASE_START',
  'PURCHASE_COMPLETE',
  'COMMISSION_REQUEST',
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
]);

const eventPropertiesSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (props) => Object.keys(props).every((key) => !PII_PROPERTY_KEYS.has(key.toLowerCase())),
    { error: 'properties must not contain PII fields (email, password, phone, etc.).' },
  )
  .optional();

export const analyticsEventSchema = z.object({
  type: z.enum(ANALYTICS_EVENT_TYPES),
  userId: uuidSchema.optional(),
  properties: eventPropertiesSchema,
  timestamp: z.coerce.date().optional(),
});

export const analyticsEventBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(100),
});

export type AnalyticsEventBatchSchema = z.infer<typeof analyticsEventBatchSchema>;
