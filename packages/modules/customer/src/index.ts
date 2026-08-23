import type { Database } from '@salon/database';
import { type RequestHandler, Router } from 'express';
import { CustomerController } from './api/controllers/customer.controller.js';
import { CustomerFavoriteController } from './api/controllers/customer-favorite.controller.js';
import { CustomerTagController } from './api/controllers/customer-tag.controller.js';
import type { IBusinessValidator } from './application/ports/business-validator.port.js';
import type { IStaffValidator } from './application/ports/staff-validator.port.js';
import {
  CustomerQueryService,
  type ICustomerQueryService,
} from './application/services/customer-query.service.js';
import { AddCustomerNoteUseCase } from './application/use-cases/add-customer-note.use-case.js';
import { AddFavoriteUseCase } from './application/use-cases/add-favorite.use-case.js';
import { ArchiveCustomerUseCase } from './application/use-cases/archive-customer.use-case.js';
import { AssignCustomerTagUseCase } from './application/use-cases/assign-customer-tag.use-case.js';
import { CreateCustomerUseCase } from './application/use-cases/create-customer.use-case.js';
import { CreateCustomerTagUseCase } from './application/use-cases/create-customer-tag.use-case.js';
import { DeleteCustomerNoteUseCase } from './application/use-cases/delete-customer-note.use-case.js';
import { DeleteCustomerTagUseCase } from './application/use-cases/delete-customer-tag.use-case.js';
import { GetCustomerDetailsUseCase } from './application/use-cases/get-customer-details.use-case.js';
import { GetCustomerNotesUseCase } from './application/use-cases/get-customer-notes.use-case.js';
import { GetCustomerTagsUseCase } from './application/use-cases/get-customer-tags.use-case.js';
import { GetCustomersUseCase } from './application/use-cases/get-customers.use-case.js';
import { GetOrCreateCustomerForUserUseCase } from './application/use-cases/get-or-create-customer-for-user.use-case.js';
import { GetUserFavoritesUseCase } from './application/use-cases/get-user-favorites.use-case.js';
import { RemoveFavoriteUseCase } from './application/use-cases/remove-favorite.use-case.js';
import { UnassignCustomerTagUseCase } from './application/use-cases/unassign-customer-tag.use-case.js';
import { UpdateCustomerUseCase } from './application/use-cases/update-customer.use-case.js';
import { CustomerRepository } from './infrastructure/repositories/customer.repository.js';
import { CustomerFavoriteRepository } from './infrastructure/repositories/customer-favorite.repository.js';
import { CustomerNoteRepository } from './infrastructure/repositories/customer-note.repository.js';
import { CustomerTagRepository } from './infrastructure/repositories/customer-tag.repository.js';

export * from './api/controllers/index.js';
export * from './api/docs/customer.openapi.js';
export * from './api/dtos/index.js';
export * from './application/ports/business-validator.port.js';
export * from './application/ports/customer-repository.port.js';
export * from './application/ports/staff-validator.port.js';
export * from './application/services/customer-query.service.js';
export * from './application/use-cases/index.js';
export * from './domain/entities/index.js';
export * from './infrastructure/repositories/customer.repository.js';
export * from './infrastructure/repositories/customer-favorite.repository.js';
export * from './infrastructure/repositories/customer-note.repository.js';
export * from './infrastructure/repositories/customer-tag.repository.js';

export interface CustomerModuleDependencies {
  database: Database;
  authMiddleware: RequestHandler;
  tenantMiddleware: RequestHandler;
  requirePermission: (permissionCode: string) => RequestHandler;
  businessValidator: IBusinessValidator;
  staffValidator: IStaffValidator;
}

export interface CustomerModule {
  customerRouter: Router;
  customerTagRouter: Router;
  favoriteRouter: Router;
  customerQueryService: ICustomerQueryService;
  useCases: {
    createCustomerUseCase: CreateCustomerUseCase;
    getCustomersUseCase: GetCustomersUseCase;
    getCustomerDetailsUseCase: GetCustomerDetailsUseCase;
    updateCustomerUseCase: UpdateCustomerUseCase;
    archiveCustomerUseCase: ArchiveCustomerUseCase;
    getOrCreateCustomerForUserUseCase: GetOrCreateCustomerForUserUseCase;
    addCustomerNoteUseCase: AddCustomerNoteUseCase;
    getCustomerNotesUseCase: GetCustomerNotesUseCase;
    deleteCustomerNoteUseCase: DeleteCustomerNoteUseCase;
    createCustomerTagUseCase: CreateCustomerTagUseCase;
    getCustomerTagsUseCase: GetCustomerTagsUseCase;
    deleteCustomerTagUseCase: DeleteCustomerTagUseCase;
    assignCustomerTagUseCase: AssignCustomerTagUseCase;
    unassignCustomerTagUseCase: UnassignCustomerTagUseCase;
    addFavoriteUseCase: AddFavoriteUseCase;
    removeFavoriteUseCase: RemoveFavoriteUseCase;
    getUserFavoritesUseCase: GetUserFavoritesUseCase;
  };
}

export function createCustomerModule(deps: CustomerModuleDependencies): CustomerModule {
  // 1. Repositories (4 focused repositories)
  const customerRepository = new CustomerRepository(deps.database);
  const customerNoteRepository = new CustomerNoteRepository(deps.database);
  const customerTagRepository = new CustomerTagRepository(deps.database);
  const customerFavoriteRepository = new CustomerFavoriteRepository(deps.database);

  // 2. Query Service (Pure read-only)
  const customerQueryService = new CustomerQueryService(customerRepository);

  // 3. Use Cases
  const createCustomerUseCase = new CreateCustomerUseCase(customerRepository);
  const getCustomersUseCase = new GetCustomersUseCase(customerRepository);
  const getCustomerDetailsUseCase = new GetCustomerDetailsUseCase(customerRepository);
  const updateCustomerUseCase = new UpdateCustomerUseCase(customerRepository);
  const archiveCustomerUseCase = new ArchiveCustomerUseCase(customerRepository);
  const getOrCreateCustomerForUserUseCase = new GetOrCreateCustomerForUserUseCase(
    customerRepository,
  );

  const addCustomerNoteUseCase = new AddCustomerNoteUseCase(
    customerRepository,
    customerNoteRepository,
  );
  const getCustomerNotesUseCase = new GetCustomerNotesUseCase(
    customerRepository,
    customerNoteRepository,
  );
  const deleteCustomerNoteUseCase = new DeleteCustomerNoteUseCase(customerNoteRepository);

  const createCustomerTagUseCase = new CreateCustomerTagUseCase(customerTagRepository);
  const getCustomerTagsUseCase = new GetCustomerTagsUseCase(customerTagRepository);
  const deleteCustomerTagUseCase = new DeleteCustomerTagUseCase(customerTagRepository);
  const assignCustomerTagUseCase = new AssignCustomerTagUseCase(
    customerRepository,
    customerTagRepository,
  );
  const unassignCustomerTagUseCase = new UnassignCustomerTagUseCase(
    customerRepository,
    customerTagRepository,
  );

  const addFavoriteUseCase = new AddFavoriteUseCase(
    customerFavoriteRepository,
    deps.businessValidator,
    deps.staffValidator,
  );
  const removeFavoriteUseCase = new RemoveFavoriteUseCase(customerFavoriteRepository);
  const getUserFavoritesUseCase = new GetUserFavoritesUseCase(customerFavoriteRepository);

  // 4. Controllers
  const customerController = new CustomerController(
    createCustomerUseCase,
    getCustomersUseCase,
    getCustomerDetailsUseCase,
    updateCustomerUseCase,
    archiveCustomerUseCase,
    addCustomerNoteUseCase,
    getCustomerNotesUseCase,
    deleteCustomerNoteUseCase,
    assignCustomerTagUseCase,
    unassignCustomerTagUseCase,
  );

  const customerTagController = new CustomerTagController(
    createCustomerTagUseCase,
    getCustomerTagsUseCase,
    deleteCustomerTagUseCase,
  );

  const customerFavoriteController = new CustomerFavoriteController(
    addFavoriteUseCase,
    removeFavoriteUseCase,
    getUserFavoritesUseCase,
  );

  // 5. Routers

  // A. Tenant Customer CRM Router (mounted at /api/v1/businesses/:businessId/customers)
  const customerRouter = Router({ mergeParams: true });
  customerRouter.use(deps.authMiddleware);
  customerRouter.use(deps.tenantMiddleware);

  customerRouter.post(
    '/',
    deps.requirePermission('customer.create'),
    customerController.create.bind(customerController),
  );
  customerRouter.get(
    '/',
    deps.requirePermission('customer.read'),
    customerController.findAll.bind(customerController),
  );
  customerRouter.get(
    '/:customerId',
    deps.requirePermission('customer.read'),
    customerController.findById.bind(customerController),
  );
  customerRouter.patch(
    '/:customerId',
    deps.requirePermission('customer.update'),
    customerController.update.bind(customerController),
  );
  customerRouter.delete(
    '/:customerId',
    deps.requirePermission('customer.delete'),
    customerController.archive.bind(customerController),
  );

  // Notes Sub-resource
  customerRouter.post(
    '/:customerId/notes',
    deps.requirePermission('customer.update'),
    customerController.addNote.bind(customerController),
  );
  customerRouter.get(
    '/:customerId/notes',
    deps.requirePermission('customer.read'),
    customerController.getNotes.bind(customerController),
  );
  customerRouter.delete(
    '/:customerId/notes/:noteId',
    deps.requirePermission('customer.delete'),
    customerController.deleteNote.bind(customerController),
  );

  // Tag Assignments Sub-resource
  customerRouter.post(
    '/:customerId/tags',
    deps.requirePermission('customer.update'),
    customerController.assignTag.bind(customerController),
  );
  customerRouter.delete(
    '/:customerId/tags/:tagId',
    deps.requirePermission('customer.update'),
    customerController.unassignTag.bind(customerController),
  );

  // B. Tenant Customer Tags Router (mounted at /api/v1/businesses/:businessId/customer-tags)
  const customerTagRouter = Router({ mergeParams: true });
  customerTagRouter.use(deps.authMiddleware);
  customerTagRouter.use(deps.tenantMiddleware);

  customerTagRouter.post(
    '/',
    deps.requirePermission('customer.create'),
    customerTagController.create.bind(customerTagController),
  );
  customerTagRouter.get(
    '/',
    deps.requirePermission('customer.read'),
    customerTagController.findAll.bind(customerTagController),
  );
  customerTagRouter.delete(
    '/:tagId',
    deps.requirePermission('customer.delete'),
    customerTagController.delete.bind(customerTagController),
  );

  // C. B2C User Favorites Router (mounted at /api/v1/favorites)
  const favoriteRouter = Router();
  favoriteRouter.use(deps.authMiddleware);

  favoriteRouter.post('/', customerFavoriteController.create.bind(customerFavoriteController));
  favoriteRouter.get('/', customerFavoriteController.findAll.bind(customerFavoriteController));
  favoriteRouter.delete(
    '/:favoriteId',
    customerFavoriteController.delete.bind(customerFavoriteController),
  );

  return {
    customerRouter,
    customerTagRouter,
    favoriteRouter,
    customerQueryService,
    useCases: {
      createCustomerUseCase,
      getCustomersUseCase,
      getCustomerDetailsUseCase,
      updateCustomerUseCase,
      archiveCustomerUseCase,
      getOrCreateCustomerForUserUseCase,
      addCustomerNoteUseCase,
      getCustomerNotesUseCase,
      deleteCustomerNoteUseCase,
      createCustomerTagUseCase,
      getCustomerTagsUseCase,
      deleteCustomerTagUseCase,
      assignCustomerTagUseCase,
      unassignCustomerTagUseCase,
      addFavoriteUseCase,
      removeFavoriteUseCase,
      getUserFavoritesUseCase,
    },
  };
}
