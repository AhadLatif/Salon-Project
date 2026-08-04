import type { Express } from 'express';
import { registerHealthRoutes } from './health.route.js';

export function registerRoutes(app: Express): void {
  registerHealthRoutes(app);
}
