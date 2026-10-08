import type { Database } from '@salon/database';
import type { RequestHandler } from 'express';
import { Router } from 'express';
import { MarketplaceController } from './api/controllers/marketplace.controller.js';
import {
  GetBusinessListUseCase,
  GetBusinessProfileUseCase,
} from './application/use-cases/index.js';
import { MarketplaceQueryService } from './infrastructure/services/marketplace-query.service.js';

/**
 * The identity module already augments `Express.Request` with `user`. TypeScript merges
 * global interface declarations, and merged members must be *identical* — so this module
 * mirrors the identity shape exactly instead of narrowing it. A narrower `user?: { userId }`
 * here compiles fine in isolation and then silently conflicts once both packages sit in the
 * same program.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export interface MarketplaceModuleDependencies {
  /** Verifies a Bearer token when present; never rejects. Never 401s. */
  optionalAuth: RequestHandler;
  database: Database;
}

export interface MarketplaceModule {
  marketplaceRouter: Router;
}

export function createMarketplaceModule(deps: MarketplaceModuleDependencies): MarketplaceModule {
  const marketplaceRouter = Router();
  const queryService = new MarketplaceQueryService(deps.database);

  const getBusinessProfileUseCase = new GetBusinessProfileUseCase(queryService);
  const getBusinessListUseCase = new GetBusinessListUseCase(queryService);
  const controller = new MarketplaceController(getBusinessProfileUseCase, getBusinessListUseCase);

  // Anonymous by default: this router never applies `authMiddleware`, so a public route
  // cannot be added here by accident and it stays disjoint from the tenant-scoped
  // `/businesses/:businessId/*` routers.
  marketplaceRouter.get('/ping', deps.optionalAuth, controller.ping.bind(controller));
  marketplaceRouter.get(
    '/businesses/:slug',
    deps.optionalAuth,
    controller.getBusinessBySlug.bind(controller),
  );
  marketplaceRouter.get(
    '/businesses',
    deps.optionalAuth,
    controller.listBusinesses.bind(controller),
  );

  return { marketplaceRouter };
}
export * from './api/controllers/index.js';
export * from './api/docs/index.js';
