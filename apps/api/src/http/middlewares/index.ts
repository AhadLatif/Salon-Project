// apps/api/src/http/middlewares/index.ts
import type { Express } from 'express';
import { globalErrorHandler } from './error-handler.js';

export function registerMiddleware(app: Express): void {
  // Catch any request that didn't match a route above

  // Catch any errors thrown by routes or previous middlewares
  app.use(globalErrorHandler);
}
