/**
 * Marketplace routes (v1).
 *
 * @openapi
 * /api/v1/marketplace:
 *   get:
 *     summary: Browse published artworks
 *     description: >
 *       Only published, unsold artworks are ever returned — this is a
 *       discovery surface, not an owner-management one. Results are cached
 *       in Redis for 30 seconds per unique filter/sort/cursor combination.
 *     tags: [Marketplace]
 *     parameters:
 *       - in: query
 *         name: category
 *         description: One of the ArtworkCategory enum values.
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
 *         name: verifiedOnly
 *         description: Restrict results to artworks by verified artists.
 *         schema: { type: boolean }
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, price_asc, price_desc, popular, rating]
 *           default: newest
 *         description: >
 *           `rating` currently aliases to `newest` (no rating aggregate is
 *           wired in yet). `popular` ranks by the same view-based score
 *           used by `/marketplace/trending` where available.
 *       - in: query
 *         name: cursor
 *         description: Opaque cursor from a previous page's `nextCursor`.
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Page of artworks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkPageResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/marketplace/featured:
 *   get:
 *     summary: Featured artworks
 *     description: >
 *       Currently a "most recently published" proxy — there's no
 *       editorial-curation flag to rank by yet.
 *     tags: [Marketplace]
 *     responses:
 *       200:
 *         description: Featured artworks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkListResponse'
 * /api/v1/marketplace/trending:
 *   get:
 *     summary: Trending (most-viewed) artworks
 *     description: >
 *       Ranked by a Redis view-count score (see the artwork detail/view
 *       endpoints in other feature areas for what records a view). Falls
 *       back to `featured` when Redis isn't configured or nothing has been
 *       viewed yet.
 *     tags: [Marketplace]
 *     responses:
 *       200:
 *         description: Trending artworks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkListResponse'
 */

import { getFeatured, getMarketplace, getTrending } from '@/controllers';
import { validate } from '@/middlewares';
import { marketplaceListSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const marketplaceRouter = createFeatureRouter('marketplace');

marketplaceRouter.get('/featured', getFeatured);
marketplaceRouter.get('/trending', getTrending);
marketplaceRouter.get('/', validate({ query: marketplaceListSchema }), getMarketplace);
