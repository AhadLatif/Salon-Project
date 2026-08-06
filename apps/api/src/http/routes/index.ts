import { config } from '@salon/config';
import { db } from '@salon/database';
import { createIdentityModule } from '@salon/identity';
import type { Express } from 'express';
import { registerHealthRoutes } from './health.route.js';

export function initializeModules(app: Express): void {
  registerHealthRoutes(app);

  // 1. Initialize Identity Module with explicit dependencies
  const identityModule = createIdentityModule({
    database: db,
    jwtSecret: config.secret.jwt, // Driven strictly by @salon/config
  });

  // 2. Mount Module Routers onto API Pipeline
  app.use('/api/v1/auth', identityModule.authRouter);

  // (Future modules like Business, Staff, Appointments will be mounted here in the exact same manner)
}
