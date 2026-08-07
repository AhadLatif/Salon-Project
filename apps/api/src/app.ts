// apps/api/src/app.ts
import type { Express } from 'express';
import express from 'express';
import { registerMiddleware } from './http/middlewares/index.js';
import { httpLoggerMiddleware } from './http/middlewares/pino-logger.middleware.js';
import { createDocsRouter } from './http/routes/docs.route.js';
import { initializeModules } from './http/routes/index.js';

export function createApp(): Express {
  const app = express();

  // 1. Request logging & body parsing (Must be first)
  app.use(httpLoggerMiddleware);
  app.use(express.json());

  // 2. Interactive Documentation Route (Scalar UI at /docs)
  app.use(createDocsRouter());

  // 3. Register application routes NEXT
  initializeModules(app);

  // 4. Register terminal middlewares (404 and Global Error Handler MUST be last)
  registerMiddleware(app);

  return app;
}
