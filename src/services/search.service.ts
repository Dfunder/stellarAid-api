/**
 * Full-text artwork search.
 *
 * Uses Postgres's built-in `to_tsvector`/`plainto_tsquery`/`ts_rank`
 * computed inline in the query — no stored/generated tsvector column or
 * migration needed. Ranked results use an opaque offset-based cursor
 * (base64 of a numeric offset) since rank isn't a stable keyset cursor the
 * way `id` is for `marketplace.service`'s browse endpoint.
 */

import { Prisma, type Artwork, type ArtworkCategory, type Asset } from '@prisma/client';

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
  readonly nextCursor: string | null;
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64');
}

function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }
  const offset = Number.parseInt(Buffer.from(cursor, 'base64').toString('utf8'), 10);
  return Number.isNaN(offset) || offset < 0 ? 0 : offset;
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
  filters: SearchFilters,
  cursor: string | undefined,
  limit: number,
): Promise<SearchPage> {
  if (q.trim() === '') {
    const page = await browseArtworks(filters, 'newest', undefined, limit);
    return page;
  }

  const offset = decodeCursor(cursor);
  const filterSql = buildFilterSql(filters);

  const rows = await prisma.$queryRaw<Artwork[]>(Prisma.sql`
    SELECT *
    FROM "Artwork"
    WHERE "published" = true
      AND "sold" = false
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
