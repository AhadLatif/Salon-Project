import { getTenantContext, getUuidParam, validateBody } from '@salon/shared';
import type { Request, Response } from 'express';
import type { CreateCategoryUseCase } from '../../application/use-cases/create-category.use-case.js';
import type { DeactivateCategoryUseCase } from '../../application/use-cases/deactivate-category.use-case.js';
import type { GetCategoriesUseCase } from '../../application/use-cases/get-categories.use-case.js';
import type { UpdateCategoryUseCase } from '../../application/use-cases/update-category.use-case.js';
import { createCategorySchema } from '../dtos/create-category.schema.js';
import { updateCategorySchema } from '../dtos/update-category.schema.js';

export class ServiceCategoryController {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly getCategoriesUseCase: GetCategoriesUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly deactivateCategoryUseCase: DeactivateCategoryUseCase,
  ) {}

  /**
   * Creates a new service category grouping (e.g. "Haircuts", "Coloring", "Nails").
   *
   * @http POST /api/v1/businesses/:businessId/service-categories
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @body
   *   - name: string (1-100 chars)
   *   - description?: string
   *   - displayOrder?: number
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('service.create')
   *          -> ServiceCategoryController.createCategory
   *          -> validateBody(createCategorySchema)
   *          -> CreateCategoryUseCase.execute
   *          -> ServiceCategoryRepository.create
   *
   * @returns 201 Created { success: true, data: { category: { id, name, displayOrder, ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 409 Conflict (Category name already exists in this business)
   */
  createCategory = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const data = validateBody(createCategorySchema, req.body, 'Invalid category data');

    const category = await this.createCategoryUseCase.execute({
      ...data,
      businessId,
    });

    res.status(201).json({
      success: true,
      data: { category: category.toPrimitives() },
      meta: {},
    });
  };

  /**
   * Returns all service categories defined for the business tenant.
   *
   * @http GET /api/v1/businesses/:businessId/service-categories
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @query
   *   - includeInactive?: 'true' | 'false'
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware
   *          -> ServiceCategoryController.getCategories
   *          -> GetCategoriesUseCase.execute(businessId, options)
   *          -> ServiceCategoryRepository.findAllByBusinessId
   *
   * @returns 200 OK { success: true, data: { categories: [ ... ] }, meta: {} }
   * @throws 401 Unauthorized
   */
  getCategories = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);

    // Parse query params for filtering
    const includeInactive = req.query.includeInactive === 'true';

    const categories = await this.getCategoriesUseCase.execute(businessId, { includeInactive });

    res.status(200).json({
      success: true,
      data: { categories: categories.map((c) => c.toPrimitives()) },
      meta: {},
    });
  };

  /**
   * Updates an existing service category's name or display order.
   *
   * @http PATCH /api/v1/businesses/:businessId/service-categories/:categoryId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :categoryId (UUID)
   * @body
   *   - name?: string
   *   - description?: string
   *   - displayOrder?: number
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('service.update')
   *          -> ServiceCategoryController.updateCategory
   *          -> validateBody(updateCategorySchema)
   *          -> UpdateCategoryUseCase.execute(businessId, categoryId, data)
   *          -> ServiceCategoryRepository.update
   *
   * @returns 200 OK { success: true, data: { category: { ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 404 Not Found
   */
  updateCategory = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const categoryId = getUuidParam(req, 'categoryId');
    const data = validateBody(updateCategorySchema, req.body, 'Invalid category update data');

    const category = await this.updateCategoryUseCase.execute(businessId, categoryId, data);

    res.status(200).json({
      success: true,
      data: { category: category.toPrimitives() },
      meta: {},
    });
  };

  /**
   * Deactivates a service category.
   *
   * @http DELETE /api/v1/businesses/:businessId/service-categories/:categoryId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :categoryId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('service.delete')
   *          -> ServiceCategoryController.deactivateCategory
   *          -> DeactivateCategoryUseCase.execute(businessId, categoryId)
   *          -> ServiceCategoryRepository.deactivate
   *
   * @returns 204 No Content
   * @throws 404 Not Found
   */
  deactivateCategory = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const categoryId = getUuidParam(req, 'categoryId');

    await this.deactivateCategoryUseCase.execute(businessId, categoryId);

    res.status(204).send();
  };
}
