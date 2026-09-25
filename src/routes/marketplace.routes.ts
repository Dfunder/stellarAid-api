/**
 * Marketplace routes (v1).
 *
 * @openapi
 * /api/v1/marketplace:
 *   get:
 *     summary: Browse published artworks
 *     tags: [Marketplace]
 *     parameters:
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
 *         name: verifiedOnly
 *         schema: { type: boolean }
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, price_asc, price_desc, popular, rating]
 *           default: newest
 *         description: >
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
 *               $ref: '#/components/schemas/ArtworkPageResponse'
 * /api/v1/marketplace/featured:
 *   get:
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
 */

import { getFeatured, getMarketplace } from '@/controllers';
import { validate } from '@/middlewares';
import { marketplaceListSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const marketplaceRouter = createFeatureRouter('marketplace');

marketplaceRouter.get('/featured', getFeatured);
marketplaceRouter.get('/', validate({ query: marketplaceListSchema }), getMarketplace);
