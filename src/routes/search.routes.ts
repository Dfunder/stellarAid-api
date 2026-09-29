/**
 * Search routes (v1).
 *
 * @openapi
 * /api/v1/search:
 *   get:
 *     summary: Full-text search over artwork titles, descriptions and tags
 *     description: >
 *       Ranks by Postgres `ts_rank` over a GIN expression index on title +
 *       description + tags, falling back to trigram similarity on the title
 *       (fuzzy/typo-tolerant) when the full-text query matches nothing. An
 *       empty or missing `q` is a plain filtered browse, newest first. Only
 *       published artworks are searched; matching artist names/usernames is a
 *       documented follow-up, not implemented. Results are cached for 60
 *       seconds per unique query/filter/page and paginated with an opaque
 *       offset cursor rather than the id-based keyset cursor used by
 *       `/marketplace`, because rank order is not a stable keyset.
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
 *         name: minPrice
 *         schema: { type: number, minimum: 0 }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number, minimum: 0 }
 *       - in: query
 *         name: asset
 *         schema: { type: string, enum: [USDC, XLM] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: cursor
 *         description: Opaque cursor from a previous page; takes precedence over `page`.
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Ranked search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkOffsetPageResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { getSearch } from '@/controllers';
import { validate } from '@/middlewares';
import { searchQuerySchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const searchRouter = createFeatureRouter('search');

searchRouter.get('/', validate({ query: searchQuerySchema }), getSearch);
