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
 *   patch:
 *     summary: Update an artwork
 *     description: Only the artwork's owner may update it.
 * /api/v1/artworks/{id}/tags:
 *   put:
 *     summary: Sync an artwork's tags
 *     description: >
 *       Replaces the artwork's tag list. Idempotent — syncing the same set
 *       twice has no additional effect. Any tag name not already in the
 *       shared tag vocabulary is created from this first use.
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
 *             $ref: '#/components/schemas/SyncArtworkTagsRequest'
 *     responses:
 *       200:
 *         description: Updated tag list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArtworkTagsResponse'
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
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/artworks/{id}/save:
 *   post:
 *     summary: Toggle save/unsave for an artwork
 *     description: >
 *       Idempotent toggle — POST and DELETE behave identically (both flip
 *       the current save state); two methods are exposed for REST-style
 *       clients that expect DELETE for "remove". Returns the artwork's
 *       up-to-date save count so the caller can reflect it immediately.
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
 * /api/v1/artworks/{id}/view:
 *   post:
 *     summary: Record a view of this artwork (for recently-viewed tracking)
 *     description: >
 *       Debounced to once per hour per user per artwork. Stored in Redis,
 *       not the database.
 *     responses:
 *       200:
 *         description: New save state
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
 *         description: Whether this call actually recorded a new view
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
 *         description: New save state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ToggleSaveResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Artwork not found
 */

import {
  patchArtwork,
  patchArtworkPublished,
  postArtwork,
  postArtworkView,
  removeArtwork,
} from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import {
  artworkIdParamsSchema,
  artworkSchema,
  setArtworkPublishedSchema,
  updateArtworkSchema,
} from '@/validators';
import { putArtworkTags, toggleSave } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import { artworkParamsSchema, syncArtworkTagsSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const artworksRouter = createFeatureRouter('artworks');

artworksRouter.post('/', authenticate, validate({ body: artworkSchema }), postArtwork);
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
artworksRouter.put(
  '/:id/tags',
  authenticate,
  validate({ params: artworkParamsSchema, body: syncArtworkTagsSchema }),
  putArtworkTags,
);
artworksRouter.post(
  '/:id/save',
  authenticate,
  validate({ params: artworkParamsSchema }),
  toggleSave,
);
artworksRouter.delete(
  '/:id/save',
  authenticate,
  validate({ params: artworkParamsSchema }),
  toggleSave,
);
