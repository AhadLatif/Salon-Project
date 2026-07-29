import { logger } from '@salon/logger';
import type { Express } from 'express';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { registerMiddleware } from './http/middlewares/index.js';
import { registerRoutes } from './http/routes/index.js';

/**
 * @Responsible for:
 * * Creating express()
 * Registering middleware
 * Registering routes
 * Returning the configured app
 * * It does not listen on a port.
 */

export function createApp(): Express {
  // Create the Express application instance.
  const app = express();

  // Log every incoming HTTP request.
  app.use(
    pinoHttp({
      logger,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    }),
  );

  app.use(express.json());

  // Register application routes.
  registerRoutes(app);

  //register middlewares
  registerMiddleware(app);

  return app;
}
