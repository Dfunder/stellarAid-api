import {
  AnalyticsValidationError,
  PersistedAnalyticsEventRecord,
  recordAnalyticsEvents,
  setAnalyticsEventRepository,
  validateAnalyticsEvent,
  validateEventProperties,
} from './analytics.service';
import {
  analyticsEventBatchSchema,
  findPiiPropertyKey,
} from '../validators/analytics.schemas';

describe('analytics.service & analytics.schemas Zod validation', () => {
  let persistedBatches: PersistedAnalyticsEventRecord[][];

  beforeEach(() => {
    persistedBatches = [];
    setAnalyticsEventRepository({
      createMany: ({ data }) => {
        persistedBatches.push([...data]);
        return Promise.resolve({ count: data.length });
      },
    });
  });

  afterEach(() => {
    setAnalyticsEventRepository(undefined);
  });

  describe('per-event-type property schemas', () => {
    it('validates PAGE_VIEW properties and rejects paths not starting with "/"', () => {
      const valid = validateEventProperties('PAGE_VIEW', {
        path: '/marketplace/trending',
        referrer: 'https://stellaraid.org',
        durationMs: 1450,
        utmSource: 'newsletter',
      });
      expect(valid).toEqual({
        path: '/marketplace/trending',
        referrer: 'https://stellaraid.org',
        durationMs: 1450,
        utmSource: 'newsletter',
      });

      expect(() =>
        validateEventProperties('PAGE_VIEW', { path: 'marketplace' }),
      ).toThrow(AnalyticsValidationError);
      expect(() =>
        validateEventProperties('PAGE_VIEW', {
          path: '/home',
          durationMs: -10,
        }),
      ).toThrow(AnalyticsValidationError);
    });

    it('validates ARTWORK_VIEW properties and enforces allowed source values', () => {
      const valid = validateEventProperties('ARTWORK_VIEW', {
        artworkId: 'art-123',
        artistId: 'artist-456',
        category: 'DIGITAL',
        source: 'trending',
      });
      expect(valid.artworkId).toBe('art-123');
      expect(valid.source).toBe('trending');

      expect(() => validateEventProperties('ARTWORK_VIEW', {})).toThrow(
        AnalyticsValidationError,
      );
      expect(() =>
        validateEventProperties('ARTWORK_VIEW', {
          artworkId: 'art-123',
          source: 'unknown-source',
        }),
      ).toThrow(AnalyticsValidationError);
    });

    it('validates SAVE properties and defaults action to "save"', () => {
      const defaulted = validateEventProperties('SAVE', {
        artworkId: 'art-99',
      });
      expect(defaulted).toEqual({
        artworkId: 'art-99',
        action: 'save',
      });

      const explicitUnsave = validateEventProperties('SAVE', {
        artworkId: 'art-99',
        action: 'unsave',
        collectionId: 'col-1',
      });
      expect(explicitUnsave).toEqual({
        artworkId: 'art-99',
        action: 'unsave',
        collectionId: 'col-1',
      });
    });

    it('validates PURCHASE_START and PURCHASE_COMPLETE properties', () => {
      const start = validateEventProperties('PURCHASE_START', {
        artworkId: 'art-1',
        amount: 25.5,
        asset: 'XLM',
      });
      expect(start).toEqual({
        artworkId: 'art-1',
        amount: 25.5,
        asset: 'XLM',
      });

      const complete = validateEventProperties('PURCHASE_COMPLETE', {
        artworkId: 'art-1',
        orderId: 'ord-100',
        amount: 25.5,
        asset: 'USDC',
        transactionHash: 'tx-abc-123',
      });
      expect(complete.orderId).toBe('ord-100');

      // Missing orderId on PURCHASE_COMPLETE must fail
      expect(() =>
        validateEventProperties('PURCHASE_COMPLETE', {
          artworkId: 'art-1',
          amount: 25.5,
          asset: 'USDC',
        }),
      ).toThrow(AnalyticsValidationError);

      // Non-positive amount or invalid asset must fail
      expect(() =>
        validateEventProperties('PURCHASE_START', {
          artworkId: 'art-1',
          amount: 0,
          asset: 'XLM',
        }),
      ).toThrow(AnalyticsValidationError);
      expect(() =>
        validateEventProperties('PURCHASE_START', {
          artworkId: 'art-1',
          amount: 10,
          asset: 'BTC',
        }),
      ).toThrow(AnalyticsValidationError);
    });

    it('validates COMMISSION_REQUEST properties', () => {
      const commission = validateEventProperties('COMMISSION_REQUEST', {
        commissionId: 'comm-1',
        artistId: 'artist-2',
        budget: 150,
        asset: 'EURC',
      });
      expect(commission).toEqual({
        commissionId: 'comm-1',
        artistId: 'artist-2',
        budget: 150,
        asset: 'EURC',
      });

      expect(() =>
        validateEventProperties('COMMISSION_REQUEST', {
          commissionId: 'comm-1',
        }),
      ).toThrow(AnalyticsValidationError);
    });

    it('rejects undeclared extra properties and PII/secret keys', () => {
      expect(findPiiPropertyKey({ nested: { phone_number: '12345' } })).toBe(
        'phone_number',
      );

      expect(() =>
        validateEventProperties('PAGE_VIEW', {
          path: '/profile',
          email: 'user@example.com',
        }),
      ).toThrow(/PII or secret fields/);

      expect(() =>
        validateEventProperties('PAGE_VIEW', {
          path: '/profile',
          unexpectedField: 'value',
        }),
      ).toThrow(AnalyticsValidationError);
    });
  });

  describe('ingestion via recordAnalyticsEvents & analyticsEventBatchSchema', () => {
    it('accepts and persists a valid heterogeneous batch of analytics events', async () => {
      const timestamp = new Date('2026-10-01T12:00:00.000Z');
      const result = await recordAnalyticsEvents([
        {
          type: 'PAGE_VIEW',
          userId: 'user-1',
          properties: { path: '/explore', durationMs: 800 },
          timestamp,
        },
        {
          type: 'SAVE',
          userId: 'user-1',
          properties: { artworkId: 'art-55' },
          timestamp,
        },
      ]);

      expect(result.accepted).toBe(2);
      expect(persistedBatches).toHaveLength(1);
      expect(persistedBatches[0]).toEqual([
        {
          type: 'PAGE_VIEW',
          userId: 'user-1',
          properties: { path: '/explore', durationMs: 800 },
          createdAt: timestamp,
        },
        {
          type: 'SAVE',
          userId: 'user-1',
          properties: { artworkId: 'art-55', action: 'save' },
          createdAt: timestamp,
        },
      ]);
    });

    it('rejects the entire batch and does not write to the repository if any event is invalid', async () => {
      await expect(
        recordAnalyticsEvents([
          {
            type: 'PAGE_VIEW',
            properties: { path: '/valid' },
          },
          {
            type: 'PURCHASE_COMPLETE',
            properties: {
              artworkId: 'art-1',
              // missing required orderId and negative amount
              amount: -5,
              asset: 'XLM',
            },
          },
        ]),
      ).rejects.toThrow(AnalyticsValidationError);

      expect(persistedBatches).toHaveLength(0);
    });

    it('validates request payloads through analyticsEventBatchSchema', () => {
      const validBatch = analyticsEventBatchSchema.safeParse({
        events: [
          {
            type: 'ARTWORK_VIEW',
            properties: { artworkId: 'art-10', source: 'featured' },
          },
        ],
      });
      expect(validBatch.success).toBe(true);

      const invalidBatch = analyticsEventBatchSchema.safeParse({
        events: [
          {
            type: 'ARTWORK_VIEW',
            properties: { artworkId: '' },
          },
        ],
      });
      expect(invalidBatch.success).toBe(false);
    });

    it('validates userId and timestamp on validateAnalyticsEvent', () => {
      expect(() =>
        validateAnalyticsEvent({
          type: 'PAGE_VIEW',
          userId: '   ',
          properties: { path: '/test' },
        }),
      ).toThrow(AnalyticsValidationError);

      expect(() =>
        validateAnalyticsEvent({
          type: 'PAGE_VIEW',
          timestamp: new Date('invalid-date'),
          properties: { path: '/test' },
        }),
      ).toThrow(AnalyticsValidationError);
    });
  });
});
