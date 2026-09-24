/**
 * Search routes (v1).
 *
 * @openapi
 * /api/v1/search:
 *   get:
 *     summary: Full-text search across published artworks
 *     description: >
 *       Ranks by Postgres `ts_rank` over title + description. An empty `q`
 *       falls back to a plain filtered browse (newest first). Pagination
 *       uses an opaque offset cursor, not the id-based keyset cursor used
 *       by `/marketplace` — rank order isn't a stable keyset.
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
