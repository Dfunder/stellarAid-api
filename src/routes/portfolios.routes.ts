/**
 * Portfolios routes (v1).
 *
 * @openapi
 * /api/v1/portfolios:
 *   post:
 *     summary: Create a portfolio item
 *     description: >
 *       Portfolio items are a showcase, not for sale — see Artworks for the
 *       for-sale counterpart. New items are appended after the caller's
 *       current highest order position.
 *     tags: [Portfolios]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePortfolioItemRequest'
 *     responses:
 *       201:
 *         description: Portfolio item created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PortfolioItemResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 *   get:
 *     summary: List the caller's portfolio items
 *     description: Ordered by `order` ascending.
 *     tags: [Portfolios]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Portfolio items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PortfolioItemListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 * /api/v1/portfolios/reorder:
 *   put:
 *     summary: Reorder the caller's portfolio items
 *     description: >
 *       `orderedIds` must contain exactly the caller's portfolio item ids —
 *       a missing id or one owned by someone else rejects the whole
 *       reorder rather than applying it partially.
 *     tags: [Portfolios]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReorderPortfolioItemsRequest'
 *     responses:
 *       200:
 *         description: Portfolio items in their new order
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PortfolioItemListResponse'
 *       400:
 *         description: orderedIds does not match the caller's portfolio item ids
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/portfolios/{id}:
 *   patch:
 *     summary: Update a portfolio item
 *     description: Only the item's owner may update it.
 *     tags: [Portfolios]
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
 *             $ref: '#/components/schemas/UpdatePortfolioItemRequest'
 *     responses:
 *       200:
 *         description: Updated portfolio item
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PortfolioItemResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller does not own this portfolio item
 *       404:
 *         description: Portfolio item not found
 *   delete:
 *     summary: Delete a portfolio item
 *     tags: [Portfolios]
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
 *         description: Caller does not own this portfolio item
 *       404:
 *         description: Portfolio item not found
 */

import {
  getPortfolioItems,
  patchPortfolioItem,
  postPortfolioItem,
  putPortfolioItemsOrder,
  removePortfolioItem,
} from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import {
  createPortfolioItemSchema,
  portfolioItemIdParamsSchema,
  reorderPortfolioItemsSchema,
  updatePortfolioItemSchema,
} from '@/validators';

import { createFeatureRouter } from './router-factory';

export const portfoliosRouter = createFeatureRouter('portfolios');

portfoliosRouter.post(
  '/',
  authenticate,
  validate({ body: createPortfolioItemSchema }),
  postPortfolioItem,
);
portfoliosRouter.get('/', authenticate, getPortfolioItems);
portfoliosRouter.put(
  '/reorder',
  authenticate,
  validate({ body: reorderPortfolioItemsSchema }),
  putPortfolioItemsOrder,
);
portfoliosRouter.patch(
  '/:id',
  authenticate,
  validate({ params: portfolioItemIdParamsSchema, body: updatePortfolioItemSchema }),
  patchPortfolioItem,
);
portfoliosRouter.delete(
  '/:id',
  authenticate,
  validate({ params: portfolioItemIdParamsSchema }),
  removePortfolioItem,
);
