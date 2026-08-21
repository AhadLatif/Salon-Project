import { createBranchModule, type IBranchValidationService } from '@salon/branch';
import { createBusinessModule } from '@salon/business';
import { config } from '@salon/config';
import { db } from '@salon/database';
import { createIdentityModule } from '@salon/identity';
import {
  createRbacModule,
  type IBranchValidator,
  type IStaffBranchAccessValidator,
} from '@salon/rbac';
import { createServiceModule } from '@salon/service';
import { createStaffModule, type IStaffQueryService } from '@salon/staff';
import type { Express } from 'express';
import { Router } from 'express';
import { registerHealthRoutes } from './health.route.js';

/**
 * CENTRAL APPLICATION MODULE INITIALIZATION & ROUTE MOUNTING
 *
 * Wires all domain modules and their cross-module dependencies in topological order:
 * 1. Identity Module (Auth & JWT)
 * 2. Business Module (Tenants & Memberships)
 * 3. RBAC Module (Roles & Permissions)
 * 4. Branch Module (Locations & Schedules)
 * 5. Service Module (Catalog & Branch Matrix)
 * 6. Staff Module (Profiles, Schedules & Allocations)
 *
 * Circular Dependency Resolution:
 * Uses lazy forwarder adapters (e.g. `branchValidatorForRbac`, `staffBranchValidatorForRbac`)
 * to allow modules initialized earlier in the pipeline to call validation services from
 * modules initialized later without tight coupling.
 */
export function initializeModules(app: Express): void {
  registerHealthRoutes(app);

  // 1. Initialize Identity Module (Auth & Token Service)
  const identityModule = createIdentityModule({
    database: db,
    jwtSecret: config.secret.jwt,
  });

  // 2. Initialize Business Module (Tenant Verification)
  const businessModule = createBusinessModule({
    database: db,
    authMiddleware: identityModule.authMiddleware,
  });

  // Forwarding adapters: Break circular initialization dependencies across modules
  let branchValidationService: IBranchValidationService;
  const branchValidatorForRbac: IBranchValidator = {
    isBranchInBusiness: (businessId, branchId) =>
      branchValidationService.isBranchInBusiness(businessId, branchId),
  };

  let staffQueryService: IStaffQueryService;
  const staffBranchValidatorForRbac: IStaffBranchAccessValidator = {
    hasStaffBranchAssignment: (businessId, memberId, branchId) =>
      staffQueryService.hasStaffBranchAssignment(businessId, memberId, branchId),
  };

  // 3. Initialize RBAC Module (Permission Verification & Branch Context)
  const rbacModule = createRbacModule({
    database: db,
    authMiddleware: identityModule.authMiddleware,
    tenantMiddleware: businessModule.tenantMiddleware,
    branchValidator: branchValidatorForRbac,
    staffBranchValidator: staffBranchValidatorForRbac,
  });

  // 4. Initialize Branch Module (Branch Lifecycle & Opening Hours)
  const branchModule = createBranchModule({
    database: db,
    authMiddleware: identityModule.authMiddleware,
    tenantMiddleware: businessModule.tenantMiddleware,
    requirePermission: rbacModule.requirePermission,
  });
  branchValidationService = branchModule.branchValidationService;

  // 5. Initialize Service Module (Service Catalog)
  const serviceModule = createServiceModule({
    database: db,
    authMiddleware: identityModule.authMiddleware,
    tenantMiddleware: businessModule.tenantMiddleware,
    requirePermission: rbacModule.requirePermission,
    branchValidator: branchModule.branchValidationService,
  });

  // 6. Initialize Staff Module (Staff Profiles & Schedules)
  const staffModule = createStaffModule({
    database: db,
    authMiddleware: identityModule.authMiddleware,
    tenantMiddleware: businessModule.tenantMiddleware,
    requirePermission: rbacModule.requirePermission,
    requireBranchContext: rbacModule.requireBranchContext,
    branchValidator: branchModule.branchValidationService,
    serviceValidator: serviceModule.serviceValidationService,
    businessMemberValidator: businessModule.businessValidationService,
  });
  staffQueryService = staffModule.staffQueryService;

  // 7. Mount Module Routers onto API Pipeline (/api/v1)
  const v1Router = Router();

  // SECURITY: Named `:businessId` (not `:id`) across all nested routers to enforce
  // automatic tenant IDOR verification via `getTenantContext` in controllers.
  v1Router.use('/auth', identityModule.authRouter);
  v1Router.use('/businesses', businessModule.businessRouter);
  v1Router.use('/businesses', rbacModule.rbacRouter);
  v1Router.use('/businesses/:businessId/branches', branchModule.branchRouter);
  v1Router.use('/businesses/:businessId/staff', staffModule.staffRouter);
  v1Router.use('/businesses/:businessId', serviceModule.serviceRouter);

  app.use('/api/v1', v1Router);
}
