-- Full-text search over title, description and tags, as an expression
-- index (no stored tsvector column, so no application-code change needed
-- to keep it in sync — Postgres recomputes the expression per row at
-- index-build/write time, transparently). "Artwork_fts_idx"'s expression
-- must match the WHERE/ORDER BY clause in search.service.ts's raw query
-- exactly for the planner to use it.
CREATE INDEX "Artwork_fts_idx" ON "Artwork" USING GIN (
    to_tsvector('english', "title" || ' ' || coalesce("description", '') || ' ' || coalesce("tags"::text, ''))
);

-- Trigram index for fuzzy/typo-tolerant matching on title (pg_trgm's
-- similarity()/% operator), used as a fallback when a plain full-text
-- query returns no rows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Artwork_title_trgm_idx" ON "Artwork" USING GIN ("title" gin_trgm_ops);
