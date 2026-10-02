import { config } from '@salon/config';
import cookieParser from 'cookie-parser';
import cors from 'cors';
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

  // ADR-013 requires the real client IP, otherwise every request appears to come from the
  // load balancer and ONE user exhausting the limit throttles everybody. Expressed as a HOP
  // COUNT, not `true`: trusting the whole `X-Forwarded-For` chain lets any client spoof its
  // own IP and walk straight through the rate limiter. 0 = disabled (correct for local).
  if (config.app.trustProxyHops > 0) {
    app.set('trust proxy', config.app.trustProxyHops);
  }

  // Phase 1: CORS (before the logger so preflight OPTIONS short-circuits cleanly), then
  // request logging & body parsing.
  // CORS uses an explicit allow-list — `*` is invalid with
  // `credentials: true` and would make the refresh cookie unusable by any origin.
  app.use(
    cors({
      origin: config.marketplace.corsOrigins,
      credentials: true,
    }),
  );
  app.use(httpLoggerMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  // Phase 2: Interactive Documentation Route (Scalar UI at /docs)
  app.use(createDocsRouter());

  // Phase 3: Register application routes (Module Routers)
  initializeModules(app);

  // Phase 4: Terminal middlewares (404 and Global Error Handler MUST be last)
  registerMiddleware(app);

  return app;
}
