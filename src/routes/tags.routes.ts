/**
 * Tags routes (v1).
 *
 * @openapi
 * /api/v1/tags:
 *   get:
 *     summary: List popular tags
 *     tags: [Taxonomy]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Tags
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TagListResponse'
 *   post:
 *     summary: Create a tag
 *     description: >
 *       Also created implicitly from PUT /api/v1/artworks/{id}/tags on
 *       first use — this endpoint is for creating a tag ahead of time
 *       (e.g. curated taxonomy).
 *     tags: [Taxonomy]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTagRequest'
 *     responses:
 *       201:
 *         description: Tag created (or already existed, returned as-is)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TagResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { getTags, postTag } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import { createTagSchema, tagListQuerySchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const tagsRouter = createFeatureRouter('tags');

tagsRouter.get('/', validate({ query: tagListQuerySchema }), getTags);
tagsRouter.post('/', authenticate, validate({ body: createTagSchema }), postTag);
