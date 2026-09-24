/**
 * Artworks routes (v1).
 *
 * @openapi
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

import { putArtworkTags, toggleSave } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import { artworkParamsSchema, syncArtworkTagsSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const artworksRouter = createFeatureRouter('artworks');

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
