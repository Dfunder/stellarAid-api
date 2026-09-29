/**
 * Full-text artwork search.
 *
 * Ranks by Postgres `ts_rank` over a `to_tsvector` expression on title +
 * description + tags, with a `pg_trgm` trigram fallback on title
 * (fuzzy/typo-tolerant) when the full-text query matches nothing. Results
 * are cached (cache-aside, 60s) since identical queries are common
 * (autocomplete-style re-querying, pagination).
 */

import { Prisma, type Artwork, type ArtworkCategory, type Asset } from '@prisma/client';

import { prisma } from '@/services';

import { cached } from './cache.service';
import { browseArtworks } from './marketplace.service';

export interface SearchFilters {
  readonly category?: ArtworkCategory;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly asset?: Asset;
}

export interface SearchPage {
  readonly items: readonly Artwork[];
  readonly page: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

const SEARCH_CACHE_TTL_SECONDS = 60;
const TRIGRAM_SIMILARITY_THRESHOLD = 0.2;

function buildFilterSql(filters: SearchFilters): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  if (filters.category !== undefined) {
    clauses.push(Prisma.sql`"category" = ${filters.category}::"ArtworkCategory"`);
  }
  if (filters.asset !== undefined) {
    clauses.push(Prisma.sql`"asset" = ${filters.asset}::"Asset"`);
  }
  if (filters.minPrice !== undefined) {
    clauses.push(Prisma.sql`"price" >= ${filters.minPrice}`);
  }
  if (filters.maxPrice !== undefined) {
    clauses.push(Prisma.sql`"price" <= ${filters.maxPrice}`);
  }
  return clauses.length === 0 ? Prisma.sql`` : Prisma.join(clauses, ' AND ', ' AND ');
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

/** Opaque cursor: base64url of a zero-based offset. Not a real keyset cursor
 * (rank isn't stable/indexable enough for one) but keeps a cursor-shaped
 * contract. */
function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }
  const decoded = Number.parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
  return Number.isFinite(decoded) && decoded >= 0 ? decoded : 0;
}

/** Accepts an opaque cursor string, or a 1-based page number for
 * offset-style callers; both resolve to a row offset. */
function resolveOffset(cursorOrPage: string | number | undefined, limit: number): number {
  if (typeof cursorOrPage === 'number') {
    const page = Number.isFinite(cursorOrPage) && cursorOrPage > 0 ? Math.floor(cursorOrPage) : 1;
    return (page - 1) * limit;
  }
  return decodeCursor(cursorOrPage);
}

async function fullTextSearch(
  q: string,
  filters: SearchFilters,
  offset: number,
  take: number,
): Promise<Artwork[]> {
  return prisma.$queryRaw<Artwork[]>(Prisma.sql`
    SELECT *
    FROM "Artwork"
    WHERE "published" = true
      AND "sold" = false
      ${buildFilterSql(filters)}
      AND to_tsvector('english', "title" || ' ' || coalesce("description", '') || ' ' || coalesce("tags"::text, ''))
          @@ plainto_tsquery('english', ${q})
    ORDER BY ts_rank(
      to_tsvector('english', "title" || ' ' || coalesce("description", '') || ' ' || coalesce("tags"::text, '')),
      plainto_tsquery('english', ${q})
    ) DESC
    LIMIT ${take}
    OFFSET ${offset}
  `);
}

/** Typo-tolerant fallback: trigram similarity on title, used only when the
 * full-text query above returns nothing. */
async function trigramSearch(
  q: string,
  filters: SearchFilters,
  offset: number,
  take: number,
): Promise<Artwork[]> {
  return prisma.$queryRaw<Artwork[]>(Prisma.sql`
    SELECT *
    FROM "Artwork"
    WHERE "published" = true
      AND "sold" = false
      ${buildFilterSql(filters)}
      AND similarity("title", ${q}) > ${TRIGRAM_SIMILARITY_THRESHOLD}
    ORDER BY similarity("title", ${q}) DESC
    LIMIT ${take}
    OFFSET ${offset}
  `);
}

/** An empty query is just a filtered browse, newest-first. */
export async function searchArtworks(
  query: string,
  filters: SearchFilters,
  cursorOrPage: string | number | undefined,
  limit: number,
): Promise<SearchPage> {
  const offset = resolveOffset(cursorOrPage, limit);
  const page = Math.floor(offset / limit) + 1;

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    const browsed = await browseArtworks(filters, 'newest', undefined, limit);
    return { items: browsed.items, page, limit, nextCursor: browsed.nextCursor };
  }

  const cacheKey = `search:${JSON.stringify({ q: trimmed, filters, cursorOrPage, limit })}`;

  const rows = await cached(cacheKey, SEARCH_CACHE_TTL_SECONDS, async () => {
    const ranked = await fullTextSearch(trimmed, filters, offset, limit + 1);
    if (ranked.length > 0) {
      return ranked;
    }
    return trigramSearch(trimmed, filters, offset, limit + 1);
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(offset + limit) : null;

  return { items, page, limit, nextCursor };
}
