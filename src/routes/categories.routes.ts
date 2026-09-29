/**
 * Category taxonomy routes (v1).
 *
 * @openapi
 * /api/v1/categories:
 *   get:
 *     summary: List the browsable category taxonomy
 *     description: >
 *       Top-level categories with their direct children nested one level
 *       deep. Cached for 5 minutes. Public — no authentication required.
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Category tree
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryListResponse'
 */

import { getCategories } from '@/controllers';

import { createFeatureRouter } from './router-factory';

export const categoriesRouter = createFeatureRouter('categories');

categoriesRouter.get('/', getCategories);
