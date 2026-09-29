/**
 * Full-text artwork search, backed by the GIN indexes added in
 * `prisma/migrations/20260924140000_artwork_search_indexes`:
 *
 *   - an expression index on `to_tsvector('english', title || description
 *     || tags)`, matched by this file's `ts_rank`/`plainto_tsquery` query
 *     — the WHERE/ORDER BY expressions here must stay textually identical
 *     to the index expression for Postgres to use it instead of scanning;
 *   - a `pg_trgm` trigram index on `title`, used as a fuzzy-match fallback
 *     when the full-text query returns nothing (handles typos/partial
 *     words that `to_tsvector` won't match).
 *
 * Results are cached (cache-aside, short TTL — search result caching is
 * one of the issue's explicit tasks) since identical queries are common
 * (autocomplete-style re-querying, pagination).
 *
 * Pagination: rank order isn't a stable keyset, so paging is offset-based.
 * `pageOrCursor` accepts either a 1-based page number or an opaque
 * offset cursor from a previous response's `nextCursor` (base64 of the
 * number of rows already consumed) — the two callers of this service use
 * one each.
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

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

/** Opaque cursor: base64url of a zero-based offset. Not a real keyset cursor
 * (rank isn't stable/indexable enough for one) but keeps the same
 * cursor-shaped contract as the marketplace browse endpoint. */
function decodeCursor(cursor: string): number {
  const decoded = Number.parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
  return Number.isFinite(decoded) && decoded >= 0 ? decoded : 0;
}

/** Resolves a page number or opaque offset cursor to a row offset. */
function resolveOffset(pageOrCursor: number | string | undefined, limit: number): number {
  if (typeof pageOrCursor === 'number') {
    return pageOrCursor > 0 ? (pageOrCursor - 1) * limit : 0;
  }
  if (typeof pageOrCursor === 'string') {
    return decodeCursor(pageOrCursor);
  }
  return 0;
}

function resolvePage(pageOrCursor: number | string | undefined): number {
  return typeof pageOrCursor === 'number' && pageOrCursor > 0 ? pageOrCursor : 1;
}

/** Index-matching `to_tsvector` expression — must stay textually identical
 * to `Artwork_fts_idx`'s expression (see this file's doc comment). */
const TS_VECTOR_EXPRESSION = Prisma.sql`to_tsvector('english', "title" || ' ' || coalesce("description", '') || ' ' || coalesce("tags"::text, ''))`;

/** Fragments each carry their own leading `AND`, joined with a space, so the
 * empty case collapses to nothing rather than a dangling `AND`. */
function buildFilterSql(filters: SearchFilters): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  if (filters.category !== undefined) {
    clauses.push(Prisma.sql`AND "category" = ${filters.category}::"ArtworkCategory"`);
  }
  if (filters.asset !== undefined) {
    clauses.push(Prisma.sql`AND "asset" = ${filters.asset}::"Asset"`);
  }
  if (filters.minPrice !== undefined) {
    clauses.push(Prisma.sql`AND "price" >= ${filters.minPrice}`);
  }
  if (filters.maxPrice !== undefined) {
    clauses.push(Prisma.sql`AND "price" <= ${filters.maxPrice}`);
  }
  return clauses.length === 0 ? Prisma.sql`` : Prisma.join(clauses, ' ');
}

/** Ranked full-text pass; requests one extra row so the caller can tell
 * whether another page exists. */
async function fullTextSearch(
  q: string,
  filters: SearchFilters,
  offset: number,
  limit: number,
): Promise<Artwork[]> {
  return prisma.$queryRaw<Artwork[]>(Prisma.sql`
    SELECT *
    FROM "Artwork"
    WHERE "published" = true
      AND "sold" = false
      ${buildFilterSql(filters)}
      AND ${TS_VECTOR_EXPRESSION} @@ plainto_tsquery('english', ${q})
    ORDER BY ts_rank(${TS_VECTOR_EXPRESSION}, plainto_tsquery('english', ${q})) DESC
    LIMIT ${limit + 1}
    OFFSET ${offset}
  `);
}

/** Typo-tolerant fallback: trigram similarity on title, used only when the
 * full-text query above returns nothing. */
async function trigramSearch(
  q: string,
  filters: SearchFilters,
  offset: number,
  limit: number,
): Promise<Artwork[]> {
  return prisma.$queryRaw<Artwork[]>(Prisma.sql`
    SELECT *
    FROM "Artwork"
    WHERE "published" = true
      AND "sold" = false
      ${buildFilterSql(filters)}
      AND similarity("title", ${q}) > ${TRIGRAM_SIMILARITY_THRESHOLD}
    ORDER BY similarity("title", ${q}) DESC
    LIMIT ${limit + 1}
    OFFSET ${offset}
  `);
}

export async function searchArtworks(
  query: string,
  filters: SearchFilters,
  pageOrCursor: number | string | undefined = 1,
  limit = 20,
): Promise<SearchPage> {
  const page = resolvePage(pageOrCursor);

  // An empty query is just a filtered browse, newest-first.
  if (query.trim().length === 0) {
    const browsed = await browseArtworks(filters, 'newest', undefined, limit);
    return { items: browsed.items, page, limit, nextCursor: browsed.nextCursor };
  }

  const trimmed = query.trim();
  const offset = resolveOffset(pageOrCursor, limit);
  const cacheKey = `search:${JSON.stringify({ q: trimmed, filters, offset, limit })}`;

  const rows = await cached(cacheKey, SEARCH_CACHE_TTL_SECONDS, async () => {
    const ranked = await fullTextSearch(trimmed, filters, offset, limit);
    if (ranked.length > 0) {
      return ranked;
    }
    return trigramSearch(trimmed, filters, offset, limit);
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    page,
    limit,
    nextCursor: hasMore ? encodeCursor(offset + limit) : null,
  };
}
