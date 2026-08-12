import { createBranchModule } from '@salon/branch';
import { createBusinessModule } from '@salon/business';
import { config } from '@salon/config';
import { db } from '@salon/database';
import { createIdentityModule } from '@salon/identity';
import { createRbacModule } from '@salon/rbac';
import type { Express } from 'express';
import { registerHealthRoutes } from './health.route.js';

export function initializeModules(app: Express): void {
  registerHealthRoutes(app);

  // 1. Initialize Identity Module with explicit dependencies
  const identityModule = createIdentityModule({
    database: db,
    jwtSecret: config.secret.jwt, // Driven strictly by @salon/config
  });

  // 2. Initialize Business Module
  const businessModule = createBusinessModule({
    database: db,
    authMiddleware: identityModule.authMiddleware,
  });

  // 3. Initialize RBAC Module
  const rbacModule = createRbacModule({
    database: db,
    authMiddleware: identityModule.authMiddleware,
    tenantMiddleware: businessModule.tenantMiddleware,
  });

  // 4. Initialize Branch Module
  const branchModule = createBranchModule({
    database: db,
    authMiddleware: identityModule.authMiddleware,
    tenantMiddleware: businessModule.tenantMiddleware,
    requirePermission: rbacModule.requirePermission,
  });

  // 5. Mount Module Routers onto API Pipeline
  app.use('/api/v1/auth', identityModule.authRouter);
  app.use('/api/v1/businesses', businessModule.businessRouter);
  app.use('/api/v1/businesses', rbacModule.rbacRouter);
  app.use('/api/v1/businesses/:id/branches', branchModule.branchRouter);
}
