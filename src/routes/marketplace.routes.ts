/**
 * Marketplace routes (v1).
 *
 * @openapi
 * /api/v1/marketplace:
 *   get:
 *     summary: Browse published artworks
 *     description: Cached (cache-aside, 5-minute TTL) per unique category/page/limit combination.
 *     tags: [Marketplace]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [ART, ILLUSTRATION, GRAPHIC_DESIGN, PHOTOGRAPHY, DIGITAL_PAINTING, THREE_D_ART, ANIMATION, UX_UI, MUSIC, WRITING, OTHER]
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Page of artworks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkOffsetPageResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/marketplace/trending:
 *   get:
 *     summary: Top 20 trending artworks
 *     description: >
 *       Ranked by a weighted score (view=1, save=3, purchase=5 points,
 *       accumulated in Redis) over all recorded activity — falls back to
 *       most-recently-published when nothing has a score yet. Cached for
 *       5 minutes, so results update within 5 minutes of new activity.
 *     tags: [Marketplace]
 *     responses:
 *       200:
 *         description: Trending artworks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkListResponse'
 * /api/v1/marketplace/recommended:
 *   get:
 *     summary: Recommended artworks
 *     description: >
 *       Popularity-based at MVP (same weighted ranking as `/trending`) —
 *       there's no per-user interaction history modeled yet to personalize
 *       against. Cached for 5 minutes.
 *     tags: [Marketplace]
 *     responses:
 *       200:
 *         description: Recommended artworks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkListResponse'
 */

import { getMarketplace, getRecommended, getTrending } from '@/controllers';
import { validate } from '@/middlewares';
import { marketplaceListSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const marketplaceRouter = createFeatureRouter('marketplace');

marketplaceRouter.get('/trending', getTrending);
marketplaceRouter.get('/recommended', getRecommended);
marketplaceRouter.get('/', validate({ query: marketplaceListSchema }), getMarketplace);
