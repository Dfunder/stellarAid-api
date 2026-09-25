/**
 * Marketplace routes (v1).
 *
 * @openapi
 * /api/v1/marketplace:
 *   get:
 *     summary: Browse published artworks
 *     description: Cached (cache-aside, 5-minute TTL) per unique category/page/limit combination.
 *     description: >
 *       Only published, unsold artworks are ever returned — this is a
 *       discovery surface, not an owner-management one. Results are cached
 *       in Redis for 30 seconds per unique filter/sort/cursor combination.
 *       discovery surface, not an owner-management one.
 *     tags: [Marketplace]
 *     parameters:
 *       - in: query
 *         name: category
 *         description: One of the ArtworkCategory enum values.
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
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
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
 *           `popular` and `rating` currently alias to `newest` — no
 *           engagement/rating aggregate is wired in yet.
 *       - in: query
 *         name: cursor
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
 *               $ref: '#/components/schemas/ArtworkPageResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/marketplace/featured:
 *   get:
 *     summary: Featured artworks
 *     description: >
 *       Currently a "most recently published" proxy — there's no
 *       editorial-curation flag to rank by yet.
 *     summary: Featured/trending artworks
 *     description: >
 *       Currently a "most recently published" proxy — there's no
 *       editorial-curation flag or rating aggregate to rank by yet.
 *     tags: [Marketplace]
 *     responses:
 *       200:
 *         description: Featured artworks
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

import { getMarketplace, getRecommended, getTrending } from '@/controllers';
import { getFeatured, getMarketplace, getTrending } from '@/controllers';
import { validate } from '@/middlewares';
import { marketplaceListSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const marketplaceRouter = createFeatureRouter('marketplace');

marketplaceRouter.get('/trending', getTrending);
marketplaceRouter.get('/recommended', getRecommended);
marketplaceRouter.get('/featured', getFeatured);
marketplaceRouter.get('/trending', getTrending);
marketplaceRouter.get('/', validate({ query: marketplaceListSchema }), getMarketplace);
