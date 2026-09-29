/**
 * Health routes.
 *
 * @openapi
 * /health:
 *   get:
 *     summary: Liveness probe
 *     description: Always returns 200 while the process is running.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is up
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Health'
 * /health/live:
 *   get:
 *     summary: Liveness probe (separate endpoint)
 *     description: Always returns 200 while the process is running.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Process is alive
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: 200 when the database (and optional Redis) respond; 503 otherwise.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Ready to receive traffic
 *       503:
 *         description: A required dependency is unreachable
 */

import { Router } from 'express';
import { getHealth, getLiveness, getReadiness } from '@/controllers';

export const healthRouter: Router = Router();

healthRouter.get('/health', getHealth);
healthRouter.get('/health/live', getLiveness);
healthRouter.get('/health/ready', getReadiness);
