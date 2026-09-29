/**
 * Categories routes (v1) — the browsable category taxonomy.
 *
 * @openapi
 * /api/v1/categories:
 *   get:
 *     summary: List the browsable category taxonomy
 *     description: >
 *       Top-level categories with their direct children (one level of
 *       nesting), ordered by name. Cached for 5 minutes.
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Category tree
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryListResponse'
 *             example:
 *               success: true
 *               data:
 *                 - id: 6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d
 *                   name: Illustration
 *                   slug: illustration
 *                   parentId: null
 *                   children:
 *                     - id: 1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d
 *                       name: Digital painting
 *                       slug: digital-painting
 *                       parentId: 6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d
 *                       children: []
 */

import { getCategories } from '@/controllers';

import { createFeatureRouter } from './router-factory';

export const categoriesRouter = createFeatureRouter('categories');

categoriesRouter.get('/', getCategories);
