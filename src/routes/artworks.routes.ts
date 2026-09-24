/**
 * Artworks routes (v1).
 *
 * @openapi
 * /api/v1/artworks:
 *   post:
 *     summary: Create an artwork listing
 *     tags: [Artworks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateArtworkRequest'
 *     responses:
 *       201:
 *         description: Artwork created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/artworks/{id}:
 *   get:
 *     summary: Get artwork detail
 *     description: >
 *       Public — no authentication required. Includes attached media ids,
 *       up to 6 related artworks in the same category, and a review summary
 *       aggregated from the owner's reviews (reviews target sellers, not
 *       individual artworks). When called with a valid access token, also
 *       records a debounced view for "recently viewed" tracking.
 *     tags: [Artworks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Artwork detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkDetailResponse'
 *       404:
 *         description: Artwork not found
 *   patch:
 *     summary: Update an artwork
 *     description: Only the artwork's owner may update it.
 *     tags: [Artworks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateArtworkRequest'
 *     responses:
 *       200:
 *         description: Updated artwork
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller does not own this artwork
 *       404:
 *         description: Artwork not found
 *   delete:
 *     summary: Delete an artwork
 *     tags: [Artworks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller does not own this artwork
 *       404:
 *         description: Artwork not found
 * /api/v1/artworks/{id}/publish:
 *   patch:
 *     summary: Publish or unpublish an artwork
 *     description: >
 *       Publishing (false → true) requires the artwork to have at least
 *       one attached media record; unpublishing has no such requirement.
 *       Publishing is a prerequisite for the artwork to appear in
 *       marketplace browse results.
 *     tags: [Artworks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [published]
 *             properties:
 *               published: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated artwork
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller does not own this artwork
 *       404:
 *         description: Artwork not found
 *       422:
 *         description: Cannot publish an artwork with no media attached
 */

import {
  getArtwork,
  patchArtwork,
  patchArtworkPublished,
  postArtwork,
  removeArtwork,
} from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import {
  artworkIdParamsSchema,
  artworkSchema,
  setArtworkPublishedSchema,
  updateArtworkSchema,
} from '@/validators';

import { createFeatureRouter } from './router-factory';

export const artworksRouter = createFeatureRouter('artworks');

artworksRouter.post('/', authenticate, validate({ body: artworkSchema }), postArtwork);
artworksRouter.get('/:id', validate({ params: artworkIdParamsSchema }), getArtwork);
artworksRouter.patch(
  '/:id',
  authenticate,
  validate({ params: artworkIdParamsSchema, body: updateArtworkSchema }),
  patchArtwork,
);
artworksRouter.delete(
  '/:id',
  authenticate,
  validate({ params: artworkIdParamsSchema }),
  removeArtwork,
);
artworksRouter.patch(
  '/:id/publish',
  authenticate,
  validate({ params: artworkIdParamsSchema, body: setArtworkPublishedSchema }),
  patchArtworkPublished,
);
