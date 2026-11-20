import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);
const positiveDecimal = z
  .string()
  .regex(/^(?=.*[1-9])\d+(?:\.\d+)?$/, 'Amount must be a positive decimal.');

export const analyticsEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('user_signed_up'),
    properties: z.strictObject({
      method: z.enum(['email', 'wallet']),
    }),
  }),
  z.strictObject({
    type: z.literal('campaign_created'),
    properties: z.strictObject({
      campaignId: nonEmptyString,
    }),
  }),
  z.strictObject({
    type: z.literal('campaign_viewed'),
    properties: z.strictObject({
      campaignId: nonEmptyString,
    }),
  }),
  z.strictObject({
    type: z.literal('donation_created'),
    properties: z.strictObject({
      campaignId: nonEmptyString,
      amount: positiveDecimal,
      assetCode: nonEmptyString,
    }),
  }),
  z.strictObject({
    type: z.literal('donation_completed'),
    properties: z.strictObject({
      campaignId: nonEmptyString,
      amount: positiveDecimal,
      assetCode: nonEmptyString,
      transactionHash: nonEmptyString,
    }),
  }),
]);

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
