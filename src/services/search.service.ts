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
 * Full-text artwork search.
 *
 * Uses Postgres's built-in `to_tsvector`/`plainto_tsquery`/`ts_rank`
 * computed inline in the query — no stored/generated tsvector column or
 * migration needed. Ranked results use an opaque offset-based cursor
 * (base64 of a numeric offset) since rank isn't a stable keyset cursor the
 * way `id` is for `marketplace.service`'s browse endpoint.
 */

import { Prisma, type Artwork, type ArtworkCategory, type Asset } from '@prisma/client';
 * Full-text search over artworks.
 *
 * Uses Postgres full-text search (`to_tsvector`/`plainto_tsquery`/`ts_rank`)
 * computed on the fly against `title`/`description` — no generated/stored
 * `tsvector` column, so no migration is needed for this to work, at the
 * cost of not being index-accelerated (fine at this table's current size;
 * a GIN index on a generated column is the natural next step if search
 * volume grows).
 *
 * Scope trim: only artwork title/description are searched. Matching
 * against artist name/username or the `tags` JSON array would need
 * either real relations (artist) or a different indexing strategy (tags
 * are an unindexed `Json` column, not a queryable array), both larger
 * changes than this pass — noted as a follow-up rather than guessed at.
 */

import type { Artwork, ArtworkCategory, Asset } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from '@/services';

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
  readonly nextCursor: string | null;
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64');
}

/** Opaque cursor: base64 of a zero-based offset. Not a real keyset cursor
 * (rank isn't stable/indexable enough for one) but keeps the same
 * cursor-shaped contract as the marketplace browse endpoint. */
function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }
  const offset = Number.parseInt(Buffer.from(cursor, 'base64').toString('utf8'), 10);
  return Number.isNaN(offset) || offset < 0 ? 0 : offset;
  const decoded = Number.parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
  return Number.isFinite(decoded) && decoded >= 0 ? decoded : 0;
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

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

/** An empty query is just a filtered browse, newest-first. */
export async function searchArtworks(
  q: string,
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
  return Prisma.join(clauses, ' ');
}

/** Empty queries return recent results rather than an empty result set. */
export async function searchArtworks(
  query: string,
  filters: SearchFilters,
  cursor: string | undefined,
  limit: number,
): Promise<SearchPage> {
  if (q.trim() === '') {
    const page = await browseArtworks(filters, 'newest', undefined, limit);
    return page;
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    const recent = await browseArtworks(filters, 'newest', undefined, limit);
    return recent;
  }

  const offset = decodeCursor(cursor);
  const filterSql = buildFilterSql(filters);

  const rows = await prisma.$queryRaw<Artwork[]>(Prisma.sql`
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
      ${filterSql}
      AND to_tsvector('english', "title" || ' ' || coalesce("description", ''))
          @@ plainto_tsquery('english', ${q})
    ORDER BY ts_rank(
      to_tsvector('english', "title" || ' ' || coalesce("description", '')),
      plainto_tsquery('english', ${q})
    ) DESC
    LIMIT ${limit + 1}
    OFFSET ${offset}
  `);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(offset + limit) : null;

  return { items, nextCursor };
}
