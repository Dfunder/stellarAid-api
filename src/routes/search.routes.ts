/**
 * Search routes (v1).
 *
 * @openapi
 * /api/v1/search:
 *   get:
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
 *         description: Ranked search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkPageResponse'
 */

import { getSearch } from '@/controllers';
import { validate } from '@/middlewares';
import { searchQuerySchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const searchRouter = createFeatureRouter('search');

searchRouter.get('/', validate({ query: searchQuerySchema }), getSearch);
