// apps/api/src/app.ts
import { logger } from '@salon/logger';
import type { Express } from 'express';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { registerMiddleware } from './http/middlewares/index.js';
import { initializeModules } from './http/routes/index.js';
export function createApp(): Express {
  const app = express();

  // 1. Request logging & body parsing (Must be first)
  app.use(
    pinoHttp({
      logger,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    }),
  );
  app.use(express.json());

  // 2. Register application routes NEXT
  initializeModules(app);
  // 3. Register terminal middlewares (404 and Global Error Handler MUST be last)
  registerMiddleware(app);

  return app;
}
