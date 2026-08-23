import { getTenantContext, getUuidParam, validateBody } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { CreateCustomerTagUseCase } from '../../application/use-cases/create-customer-tag.use-case.js';
import type { DeleteCustomerTagUseCase } from '../../application/use-cases/delete-customer-tag.use-case.js';
import type { GetCustomerTagsUseCase } from '../../application/use-cases/get-customer-tags.use-case.js';
import { createCustomerTagSchema } from '../dtos/create-customer-tag.schema.js';

export class CustomerTagController {
  constructor(
    private readonly createCustomerTagUseCase: CreateCustomerTagUseCase,
    private readonly getCustomerTagsUseCase: GetCustomerTagsUseCase,
    private readonly deleteCustomerTagUseCase: DeleteCustomerTagUseCase,
  ) {}

  /**
   * Creates a new business tag definition (e.g. "VIP", "New", "Allergies").
   *
   * @http POST /api/v1/businesses/:businessId/customer-tags
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @body
   *   - name: string (1-50 chars)
   *   - color?: string (hex color code e.g. "#FF5733")
   *   - description?: string (max 255 chars)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.update')
   *          -> CustomerTagController.create
   *          -> validateBody(createCustomerTagSchema)
   *          -> CreateCustomerTagUseCase.execute
   *          -> CustomerTagRepository.create
   *
   * @returns 201 Created { success: true, data: { tag: { id, name, color, ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 409 Conflict (Tag name already exists in this business)
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const data = validateBody(createCustomerTagSchema, req.body, 'Invalid customer tag payload');

      const tag = await this.createCustomerTagUseCase.execute({
        ...data,
        businessId,
      });

      res.status(201).json({
        success: true,
        data: { tag },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves all tags defined in the salon business.
   *
   * @http GET /api/v1/businesses/:businessId/customer-tags
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.view')
   *          -> CustomerTagController.findAll
   *          -> GetCustomerTagsUseCase.execute(businessId)
   *          -> CustomerTagRepository.findAll
   *
   * @returns 200 OK { success: true, data: { tags: [ ... ] }, meta: {} }
   */
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const tags = await this.getCustomerTagsUseCase.execute(businessId);

      res.status(200).json({
        success: true,
        data: { tags },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Deletes a business tag definition and removes it from all associated customer profiles.
   *
   * @http DELETE /api/v1/businesses/:businessId/customer-tags/:tagId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :tagId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('customer.update')
   *          -> CustomerTagController.delete
   *          -> DeleteCustomerTagUseCase.execute(businessId, tagId)
   *          -> CustomerTagRepository.delete
   *
   * @returns 200 OK { success: true, data: { deleted: true }, meta: {} }
   * @throws 404 Not Found
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const tagId = getUuidParam(req, 'tagId');

      await this.deleteCustomerTagUseCase.execute(businessId, tagId);

      res.status(200).json({
        success: true,
        data: { deleted: true },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }
}
