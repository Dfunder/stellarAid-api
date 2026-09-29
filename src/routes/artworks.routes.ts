/**
 * Artwork routes (v1).
 *
 * @openapi
 * /api/v1/artworks:
 *   post:
 *     summary: Create an artwork
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
 *         description: Created artwork
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
 *     summary: Get an artwork's public detail
 *     description: >
 *       Public. Records a debounced view for the caller when a valid access
 *       token is supplied.
 *     tags: [Artworks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Artwork detail (media, related artworks, review summary)
 *       404:
 *         description: Artwork not found
 *   patch:
 *     summary: Update an artwork
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
 *       403:
 *         description: Caller does not own this artwork
 *       404:
 *         description: Artwork not found
 * /api/v1/artworks/{id}/publish:
 *   patch:
 *     summary: Publish or unpublish an artwork
 *     description: >
 *       Publishing (false → true) requires the artwork to have at least one
 *       attached media record; unpublishing has no such requirement.
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
 *       403:
 *         description: Caller does not own this artwork
 *       404:
 *         description: Artwork not found
 *       422:
 *         description: Cannot publish an artwork with no media attached
 * /api/v1/artworks/{id}/view:
 *   post:
 *     summary: Record a view of this artwork
 *     description: Debounced to once per hour per user per artwork; stored in Redis.
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 * /api/v1/artworks/{id}/save:
 *   post:
 *     summary: Toggle save/unsave for an artwork
 *     description: >
 *       Idempotent toggle — POST and DELETE behave identically (both flip
 *       the current save state).
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
 *               $ref: '#/components/schemas/ToggleSaveResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Artwork not found
 *   delete:
 *     summary: Toggle save/unsave for an artwork (same as POST)
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 * /api/v1/artworks/{id}/tags:
 *   put:
 *     summary: Replace an artwork's tags
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
 *             $ref: '#/components/schemas/SyncArtworkTagsRequest'
 *     responses:
 *       200:
 *         description: Updated artwork tags
 *       403:
 *         description: Caller does not own this artwork
 *       404:
 *         description: Artwork not found
 */

import {
  getArtwork,
  patchArtwork,
  patchArtworkPublished,
  postArtwork,
  postArtworkSave,
  postArtworkView,
  putArtworkTags,
  removeArtwork,
  toggleSave,
} from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import {
  artworkIdParamsSchema,
  artworkParamsSchema,
  artworkSchema,
  setArtworkPublishedSchema,
  syncArtworkTagsSchema,
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
artworksRouter.post(
  '/:id/view',
  authenticate,
  validate({ params: artworkIdParamsSchema }),
  postArtworkView,
);
artworksRouter.post(
  '/:id/save',
  authenticate,
  validate({ params: artworkParamsSchema }),
  postArtworkSave,
);
artworksRouter.delete(
  '/:id/save',
  authenticate,
  validate({ params: artworkParamsSchema }),
  toggleSave,
);
artworksRouter.put(
  '/:id/tags',
  authenticate,
  validate({ params: artworkParamsSchema, body: syncArtworkTagsSchema }),
  putArtworkTags,
);
