import { createHash } from 'node:crypto';

/**
 * Generates a weak validator for a response body. Weak ETags are used
 * because the API serves JSON where semantic equivalence (not byte-level
 * identity) is what matters for caching.
 */
export function generateETag(body: unknown): string {
  const payload = typeof body === 'string' ? body : JSON.stringify(body) ?? '';
  const hash = createHash('md5')
    .update(payload)
    .digest('base64')
    .replace(/[+/=]/g, (c) =>
      c === '+' ? '-' : c === '/' ? '_' : '',
    )
    .slice(0, 27);
  return `W/"${hash}"`;
}

/** Strips the weak-validator prefix so tags compare semantically. */
function normalizeTag(tag: string): string {
  return tag.trim().replace(/^W\//i, '');
}

/**
 * Weak-compares an `If-None-Match` request header against an ETag,
 * honoring wildcard and comma-separated candidate lists per RFC 9110.
 */
export function etagMatches(
  ifNoneMatch: string | undefined,
  etag: string,
): boolean {
  if (!ifNoneMatch) {
    return false;
  }
  if (ifNoneMatch.trim() === '*') {
    return true;
  }
  const target = normalizeTag(etag);
  return ifNoneMatch
    .split(',')
    .some((candidate) => normalizeTag(candidate) === target);
}
