/**
 * Search routes (v1).
 *
 * @openapi
 * /api/v1/search:
 *   get:
 *     summary: Full-text search across published artworks
 *     description: >
 *       Ranks by Postgres `ts_rank` over a GIN expression index on title +
 *       description + tags. Falls back to trigram similarity on title
 *       (fuzzy/typo-tolerant) when the full-text query matches nothing.
 *       Results are cached for 60 seconds per unique query/filter/page.
 *       Ranks by Postgres `ts_rank` over title + description. An empty `q`
 *       falls back to a plain filtered browse (newest first). Pagination
 *       uses an opaque offset cursor, not the id-based keyset cursor used
 *       by `/marketplace` — rank order isn't a stable keyset.
 *     summary: Full-text search over artwork titles/descriptions
 *     description: >
 *       Uses Postgres `to_tsvector`/`ts_rank` computed against title and
 *       description. Empty or missing `q` returns recent results instead
 *       of an empty page. Only artworks are searched — matching against
 *       artist name/username or tags is a documented follow-up, not
 *       implemented here.
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string, maxLength: 200 }
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [ART, ILLUSTRATION, GRAPHIC_DESIGN, PHOTOGRAPHY, DIGITAL_PAINTING, THREE_D_ART, ANIMATION, UX_UI, MUSIC, WRITING, OTHER]
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         name: minPrice
 *         schema: { type: number, minimum: 0 }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number, minimum: 0 }
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: asset
 *         schema: { type: string, enum: [USDC, XLM] }
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Page of search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkOffsetPageResponse'
 *         description: Ranked search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkPageResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { getSearch } from '@/controllers';
import { validate } from '@/middlewares';
import { searchQuerySchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const searchRouter = createFeatureRouter('search');

searchRouter.get('/', validate({ query: searchQuerySchema }), getSearch);
