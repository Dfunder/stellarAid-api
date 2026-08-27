import { etagMatches, generateETag } from './etag.util';

describe('generateETag', () => {
  it('produces a weak validator wrapped in quotes', () => {
    expect(generateETag({ a: 1 })).toMatch(/^W\/"[A-Za-z0-9_-]+"$/);
  });

  it('is stable for identical payloads', () => {
    expect(generateETag({ items: [1, 2, 3] })).toBe(
      generateETag({ items: [1, 2, 3] }),
    );
  });

  it('changes when the payload changes', () => {
    expect(generateETag({ v: 1 })).not.toBe(generateETag({ v: 2 }));
  });

  it('handles strings and empty values', () => {
    expect(generateETag('body')).toMatch(/^W\/"/);
    expect(generateETag(undefined)).toMatch(/^W\/"/);
  });
});

describe('etagMatches', () => {
  const etag = generateETag({ ok: true });

  it('returns false without an If-None-Match header', () => {
    expect(etagMatches(undefined, etag)).toBe(false);
    expect(etagMatches('', etag)).toBe(false);
  });

  it('matches the exact validator, with or without the weak prefix', () => {
    expect(etagMatches(etag, etag)).toBe(true);
    expect(etagMatches(etag.replace('W/', ''), etag)).toBe(true);
  });

  it('matches a wildcard', () => {
    expect(etagMatches('*', etag)).toBe(true);
  });

  it('matches within a comma-separated candidate list', () => {
    expect(etagMatches(`"other", ${etag}`, etag)).toBe(true);
  });

  it('does not match unrelated validators', () => {
    expect(etagMatches('"something-else"', etag)).toBe(false);
  });
});
