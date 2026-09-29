/**
 * Guards the generated OpenAPI document (#830).
 *
 * `swagger-jsdoc` silently *drops* a route file whose `@openapi` block fails
 * to parse — duplicate YAML keys, bad indentation — which is how the
 * commission docs went missing from `/api/docs` while the TypeScript still
 * compiled. These assertions fail loudly if a commission operation stops
 * being documented, a referenced schema disappears, or the status machine
 * stops being explained on the tag.
 */

import { describe, expect, it } from 'vitest';

import { openApiSpec } from '@/swagger';

interface Tag {
  readonly name: string;
  readonly description?: string;
}

const spec = openApiSpec as {
  readonly paths: Record<string, Record<string, unknown>>;
  readonly components: { readonly schemas: Record<string, unknown> };
  readonly tags: readonly Tag[];
};

/** Every commission operation the API actually serves. */
const COMMISSION_OPERATIONS: ReadonlyArray<readonly [string, string]> = [
  ['/api/v1/commissions', 'post'],
  ['/api/v1/commissions/{id}', 'get'],
  ['/api/v1/commissions/{id}/status', 'patch'],
  ['/api/v1/commissions/{id}/disputes', 'post'],
  ['/api/v1/commissions/{id}/disputes/resolve', 'post'],
  ['/api/v1/admin/commissions/disputes', 'get'],
  ['/api/v1/users/me/commissions', 'get'],
];

const COMMISSION_SCHEMAS = [
  'Commission',
  'CommissionParty',
  'CommissionEvent',
  'CommissionTimelineEntry',
  'CommissionDetail',
  'CommissionDetailResponse',
  'CommissionResponse',
  'CommissionListItem',
  'CommissionListResponse',
  'CommissionReview',
  'CreateCommissionRequest',
  'Deliverable',
  'CommissionDispute',
  'CreateCommissionDisputeRequest',
  'CommissionDisputeResponse',
  'CommissionDisputeListResponse',
];

describe('OpenAPI document (#830)', () => {
  it.each(COMMISSION_OPERATIONS)('documents %s %s', (path, method) => {
    expect(spec.paths[path]?.[method]).toBeDefined();
  });

  it.each(COMMISSION_SCHEMAS)('exports the %s schema', (name) => {
    expect(spec.components.schemas[name]).toBeDefined();
  });

  it('explains the commission flow and status machine on the tag', () => {
    const commissions = spec.tags.find((tag) => tag.name === 'Commissions');
    expect(commissions?.description).toBeDefined();
    expect(commissions?.description).toContain('Status machine');
    for (const status of [
      'PENDING',
      'ACCEPTED',
      'IN_PROGRESS',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
      'DISPUTED',
    ]) {
      expect(commissions?.description).toContain(status);
    }
  });

  it('documents error responses for the transition endpoint', () => {
    const status = spec.paths['/api/v1/commissions/{id}/status'] as {
      patch: {
        responses: Record<
          string,
          { content?: { 'application/json': { examples?: Record<string, unknown> } } }
        >;
      };
    };
    expect(status.patch.responses['409']).toBeDefined();
    expect(
      Object.keys(status.patch.responses['409']!.content!['application/json'].examples!),
    ).toEqual(expect.arrayContaining(['invalidTransition', 'notCancellable', 'escrowHeld']));
  });
});
