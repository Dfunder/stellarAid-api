/**
 * Full-text artwork search, backed by the GIN indexes added in this
 * change (see `prisma/migrations/20260924140000_artwork_search_indexes`):
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
 */

import { Prisma, type Artwork, type ArtworkCategory } from '@prisma/client';

import { prisma } from '@/services';

import { cached } from './cache.service';

export interface SearchFilters {
  readonly category?: ArtworkCategory;
}

export interface SearchPage {
  readonly items: readonly Artwork[];
  readonly page: number;
  readonly limit: number;
}

const SEARCH_CACHE_TTL_SECONDS = 60;
const TRIGRAM_SIMILARITY_THRESHOLD = 0.2;

function buildFilterSql(filters: SearchFilters): Prisma.Sql {
  if (filters.category === undefined) {
    return Prisma.sql``;
  }
  return Prisma.sql`AND "category" = ${filters.category}::"ArtworkCategory"`;
}

async function fullTextSearch(
  q: string,
  filters: SearchFilters,
  page: number,
  limit: number,
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
    LIMIT ${limit}
    OFFSET ${(page - 1) * limit}
  `);
}

/** Typo-tolerant fallback: trigram similarity on title, used only when the
 * full-text query above returns nothing. */
async function trigramSearch(
  q: string,
  filters: SearchFilters,
  page: number,
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
    LIMIT ${limit}
    OFFSET ${(page - 1) * limit}
  `);
}

export async function searchArtworks(
  q: string,
  filters: SearchFilters,
  page: number,
  limit: number,
): Promise<SearchPage> {
  const trimmed = q.trim();
  if (trimmed === '') {
    return { items: [], page, limit };
  }

  const cacheKey = `search:${JSON.stringify({ q: trimmed, filters, page, limit })}`;

  const items = await cached(cacheKey, SEARCH_CACHE_TTL_SECONDS, async () => {
    const ranked = await fullTextSearch(trimmed, filters, page, limit);
    if (ranked.length > 0) {
      return ranked;
    }
    return trigramSearch(trimmed, filters, page, limit);
  });

  return { items, page, limit };
}
