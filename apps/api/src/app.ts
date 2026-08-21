import type { Express } from 'express';
import express from 'express';
import { registerMiddleware } from './http/middlewares/index.js';
import { httpLoggerMiddleware } from './http/middlewares/pino-logger.middleware.js';
import { createDocsRouter } from './http/routes/docs.route.js';
import { initializeModules } from './http/routes/index.js';

/**
 * EXPRESS APPLICATION FACTORY & MIDDLEWARE PIPELINE
 *
 * Middleware Registration Order Invariants:
 * 1. Global Request Pre-processors: Pino HTTP logging and body parsing (JSON) MUST run first
 *    so request IDs, timing, and `req.body` are available to downstream routes.
 * 2. Documentation Routes: Scalar UI (`/docs`) and OpenAPI JSON specs.
 * 3. Application Module Routers: Auth, Business, Branch, Service, RBAC, Staff API endpoints.
 * 4. Terminal Middlewares: 404 handler (catches unmatched routes) and 4-arity Global Error Handler
 *    MUST be mounted last to catch unhandled route requests and all thrown domain errors.
 */
export function createApp(): Express {
  const app = express();

  // Phase 1: Request logging & body parsing (Must be first)
  app.use(httpLoggerMiddleware);
  app.use(express.json());

  // Phase 2: Interactive Documentation Route (Scalar UI at /docs)
  app.use(createDocsRouter());

  // Phase 3: Register application routes (Module Routers)
  initializeModules(app);

  // Phase 4: Terminal middlewares (404 and Global Error Handler MUST be last)
  registerMiddleware(app);

  return app;
}
