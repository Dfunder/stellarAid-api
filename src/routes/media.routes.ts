/**
 * Media routes (v1).
 *
 * @openapi
 * /api/v1/media/presign:
 *   post:
 *     summary: Get a presigned upload URL for an image or digital file
 *     description: >
 *       Creates a `Media` record and returns a presigned S3 PUT URL. The
 *       client uploads the file bytes directly to `uploadUrl`; this endpoint
 *       never receives the file body. When `parentType`/`parentId` are given,
 *       the media is linked to that artwork or portfolio item immediately
 *       (caller must own the parent).
 *     tags: [Media]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PresignUploadRequest'
 *     responses:
 *       201:
 *         description: Presigned upload URL issued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PresignUploadResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller does not own the given parent entity
 *       404:
 *         description: Parent entity not found
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/media/{id}/complete:
 *   post:
 *     summary: Confirm an upload finished and trigger processing
 *     description: >
 *       Call after the file has been PUT to the presigned `uploadUrl`. For
 *       images, this enqueues thumbnail/WebP generation (async, via BullMQ);
 *       the response reflects whatever variants already exist.
 *     tags: [Media]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Media record (with variants, if already processed)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller does not own this media
 *       404:
 *         description: Media not found
 * /api/v1/media/{id}:
 *   get:
 *     summary: Get a media record, including any processed variants
 *     tags: [Media]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Media record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaResponse'
 *       404:
 *         description: Media not found
 */

import { completeUpload, getMedia, presignUpload } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import { mediaIdParamsSchema, presignUploadSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const mediaRouter = createFeatureRouter('media');

mediaRouter.post(
  '/presign',
  authenticate,
  validate({ body: presignUploadSchema }),
  presignUpload,
);
mediaRouter.post(
  '/:id/complete',
  authenticate,
  validate({ params: mediaIdParamsSchema }),
  completeUpload,
);
mediaRouter.get('/:id', validate({ params: mediaIdParamsSchema }), getMedia);
