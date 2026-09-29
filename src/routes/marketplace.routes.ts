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
 *       in Redis for 30 seconds per unique filter/sort/cursor combination,
 *       and paging is keyset-based on the opaque `cursor`/`nextCursor` pair.
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
 *           wired in yet). `popular` also aliases to `newest`.
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
 *       editorial-curation flag or rating aggregate to rank by yet.
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

import { getFeatured, getMarketplace, getRecommended, getTrending } from '@/controllers';
import { validate } from '@/middlewares';
import { marketplaceListSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const marketplaceRouter = createFeatureRouter('marketplace');

marketplaceRouter.get('/featured', getFeatured);
marketplaceRouter.get('/trending', getTrending);
marketplaceRouter.get('/recommended', getRecommended);
marketplaceRouter.get('/', validate({ query: marketplaceListSchema }), getMarketplace);
