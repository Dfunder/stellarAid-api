/**
 * Categories routes (v1).
 *
 * @openapi
 * /api/v1/categories:
 *   get:
 *     summary: List all categories, with sub-categories nested
 *     tags: [Taxonomy]
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
