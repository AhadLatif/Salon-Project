// apps/api/src/http/middlewares/index.ts
import { ResourceNotFoundError } from '@salon/shared';
import type { Express } from 'express';
import { globalErrorHandler } from './error-handler.js';

export function registerMiddleware(app: Express): void {
  // Catch any request that didn't match a route above
  app.use((req, _res, next) => {
    next(new ResourceNotFoundError(`Route ${req.method} ${req.originalUrl} not found.`));
  });

  // Catch any errors thrown by routes or previous middlewares
  app.use(globalErrorHandler);
}
