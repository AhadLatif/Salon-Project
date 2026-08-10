import type { db } from '@salon/database';
import { type RequestHandler, Router } from 'express';
import { BusinessController } from './api/controllers/business.controller.js';
import { createTenantMiddleware } from './api/middlewares/tenant.middleware.js';
import { CreateBusinessUseCase } from './application/use-cases/create-business.use-case.js';
import { GetBusinessByIdUseCase } from './application/use-cases/get-business-by-id.use-case.js';
import { GetMyBusinessesUseCase } from './application/use-cases/get-my-businesses.use-case.js';
import { UpdateBusinessUseCase } from './application/use-cases/update-business.use-case.js';
import { BusinessRepository } from './infrastructure/repositories/business.repository.js';

// --- 1. EXPORT ALL PORTS, CLASSES & TYPES ---
export * from './api/controllers/business.controller.js';
export * from './api/docs/business.openapi.js';
export * from './api/dtos/create-business.schema.js';
export * from './api/dtos/update-business.schema.js';
export * from './api/middlewares/tenant.middleware.js';
export * from './application/ports/business-repository.port.js';
export * from './application/use-cases/create-business.use-case.js';
export * from './application/use-cases/get-business-by-id.use-case.js';
export * from './application/use-cases/get-my-businesses.use-case.js';
export * from './application/use-cases/update-business.use-case.js';
export * from './domain/entities/business.entity.js';
export * from './infrastructure/repositories/business.repository.js';

// --- 2. DEFINE MODULE DEPENDENCIES CONTRACT ---
export interface BusinessModuleDependencies {
  database: typeof db;
  authMiddleware: RequestHandler;
}

export interface BusinessModule {
  businessRouter: Router;
  tenantMiddleware: RequestHandler;
  useCases: {
    createBusinessUseCase: CreateBusinessUseCase;
    getMyBusinessesUseCase: GetMyBusinessesUseCase;
    getBusinessByIdUseCase: GetBusinessByIdUseCase;
    updateBusinessUseCase: UpdateBusinessUseCase;
  };
}

// --- 3. THE MODULE FACTORY ---
export function createBusinessModule(deps: BusinessModuleDependencies): BusinessModule {
  // A. Infrastructure Adapters
  const businessRepository = new BusinessRepository(deps.database);

  // B. Application Use Cases
  const createBusinessUseCase = new CreateBusinessUseCase(businessRepository);
  const getMyBusinessesUseCase = new GetMyBusinessesUseCase(businessRepository);
  const getBusinessByIdUseCase = new GetBusinessByIdUseCase(businessRepository);
  const updateBusinessUseCase = new UpdateBusinessUseCase(businessRepository);

  // C. Middlewares & Controllers
  const tenantMiddleware = createTenantMiddleware(businessRepository);

  const businessController = new BusinessController(
    createBusinessUseCase,
    getMyBusinessesUseCase,
    getBusinessByIdUseCase,
    updateBusinessUseCase,
  );

  const businessRouter = Router();

  // Business Profile Routes
  businessRouter.post('/', deps.authMiddleware, businessController.create);
  businessRouter.get('/me', deps.authMiddleware, businessController.getMyBusinesses);
  businessRouter.get('/:id', deps.authMiddleware, tenantMiddleware, businessController.getById);
  businessRouter.patch('/:id', deps.authMiddleware, tenantMiddleware, businessController.update);

  return {
    businessRouter,
    tenantMiddleware,
    useCases: {
      createBusinessUseCase,
      getMyBusinessesUseCase,
      getBusinessByIdUseCase,
      updateBusinessUseCase,
    },
  };
}
