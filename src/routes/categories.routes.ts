/**
 * Category taxonomy routes (v1).
 *
 * @openapi
 * /api/v1/categories:
 *   get:
 *     summary: List the browsable category taxonomy
 *     description: >
 *       Top-level categories with their direct children (one level of
 *       nesting). Cached for 5 minutes.
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Categories
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryListResponse'
 */

import { getCategories } from '@/controllers';

import { createFeatureRouter } from './router-factory';

export const categoriesRouter = createFeatureRouter('categories');

categoriesRouter.get('/', getCategories);
