/**
 * Artworks routes (v1).
 *
 * @openapi
 * /api/v1/artworks/{id}:
 *   get:
 *     summary: Get artwork detail
 *     tags: [Artworks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Artwork
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkResponse'
 *       404:
 *         description: Artwork not found
 * /api/v1/artworks/{id}/view:
 *   post:
 *     summary: Record a view of this artwork
 *     description: >
 *       Debounced to once per hour per user per artwork; also feeds the
 *       marketplace trending score. Stored in Redis, not the database.
 *     tags: [Artworks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Whether this call recorded a new view
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, enum: [true] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     recorded: { type: boolean }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 * /api/v1/artworks/{id}/save:
 *   post:
 *     summary: Toggle saving this artwork (save/unsave)
 *     description: Creates the save if it doesn't exist, removes it if it does.
 *     tags: [Artworks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The resulting save state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, enum: [true] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     saved: { type: boolean }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Artwork not found
 */

import { getArtwork, postArtworkSave, postArtworkView } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import { artworkIdParamsSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const artworksRouter = createFeatureRouter('artworks');

artworksRouter.get('/:id', validate({ params: artworkIdParamsSchema }), getArtwork);
artworksRouter.post(
  '/:id/view',
  authenticate,
  validate({ params: artworkIdParamsSchema }),
  postArtworkView,
);
artworksRouter.post(
  '/:id/save',
  authenticate,
  validate({ params: artworkIdParamsSchema }),
  postArtworkSave,
);
