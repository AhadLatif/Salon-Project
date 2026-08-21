import { getTenantContext, getUuidParam, getUuidQuery, validateBody } from '@salon/shared';
import type { Request, Response } from 'express';
import type { AssignServiceToBranchUseCase } from '../../application/use-cases/assign-service-to-branch.use-case.js';
import type { CreateServiceUseCase } from '../../application/use-cases/create-service.use-case.js';
import type { DeactivateServiceUseCase } from '../../application/use-cases/deactivate-service.use-case.js';
import type { GetServiceBranchAssignmentsUseCase } from '../../application/use-cases/get-service-branch-assignments.use-case.js';
import type { GetServiceByIdUseCase } from '../../application/use-cases/get-service-by-id.use-case.js';
import type { GetServicesUseCase } from '../../application/use-cases/get-services.use-case.js';
import type { UnassignServiceFromBranchUseCase } from '../../application/use-cases/unassign-service-from-branch.use-case.js';
import type { UpdateServiceUseCase } from '../../application/use-cases/update-service.use-case.js';
import { assignBranchSchema } from '../dtos/assign-branch.schema.js';
import { createServiceSchema } from '../dtos/create-service.schema.js';
import { updateServiceSchema } from '../dtos/update-service.schema.js';

export class ServiceController {
  constructor(
    private readonly createServiceUseCase: CreateServiceUseCase,
    private readonly getServiceByIdUseCase: GetServiceByIdUseCase,
    private readonly getServicesUseCase: GetServicesUseCase,
    private readonly updateServiceUseCase: UpdateServiceUseCase,
    private readonly deactivateServiceUseCase: DeactivateServiceUseCase,
    private readonly assignServiceToBranchUseCase: AssignServiceToBranchUseCase,
    private readonly unassignServiceFromBranchUseCase: UnassignServiceFromBranchUseCase,
    private readonly getServiceBranchAssignmentsUseCase: GetServiceBranchAssignmentsUseCase,
  ) {}

  /**
   * Creates a new service offering in the tenant's service catalog.
   *
   * @http POST /api/v1/businesses/:businessId/services
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @body
   *   - categoryId: string (UUID)
   *   - name: string (1-150 chars)
   *   - description?: string
   *   - durationMinutes: number (1-1440, divisible by 5)
   *   - price: string (decimal format e.g. "50.00")
   *   - pricingType?: 'fixed' | 'from' | 'free' | 'varies'
   *   - colorHex?: string (hex code e.g. "#FF00AA")
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('service.create')
   *          -> ServiceController.createService
   *          -> validateBody(createServiceSchema)
   *          -> CreateServiceUseCase.execute
   *          -> ServiceRepository.create
   *
   * @returns 201 Created { success: true, data: { service: { id, name, price, durationMinutes, ... } }, meta: {} }
   * @throws 400 Bad Request (Validation failed / invalid duration interval)
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Cross-tenant IDOR / category belonging to another tenant)
   * @throws 409 Conflict (Service name already exists in this business)
   */
  createService = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const data = validateBody(createServiceSchema, req.body, 'Invalid service data');

    const service = await this.createServiceUseCase.execute({
      ...data,
      businessId,
    });

    res.status(201).json({
      success: true,
      data: { service: service.toPrimitives() },
      meta: {},
    });
  };

  /**
   * Returns details for a single service offering.
   *
   * @http GET /api/v1/businesses/:businessId/services/:serviceId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :serviceId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware
   *          -> ServiceController.getServiceById
   *          -> GetServiceByIdUseCase.execute(businessId, serviceId)
   *          -> ServiceRepository.findById
   *
   * @returns 200 OK { success: true, data: { service: { ... } }, meta: {} }
   * @throws 400 Bad Request (Invalid UUID)
   * @throws 404 Not Found (Service not found)
   */
  getServiceById = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const serviceId = getUuidParam(req, 'serviceId');

    const service = await this.getServiceByIdUseCase.execute(businessId, serviceId);

    res.status(200).json({
      success: true,
      data: { service: service.toPrimitives() },
      meta: {},
    });
  };

  /**
   * Returns all services for the business tenant with optional category and status filtering.
   *
   * @http GET /api/v1/businesses/:businessId/services
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @query
   *   - categoryId?: string (UUID)
   *   - includeInactive?: 'true' | 'false'
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware
   *          -> ServiceController.getServices
   *          -> GetServicesUseCase.execute(businessId, options)
   *          -> ServiceRepository.findAllByBusinessId
   *
   * @returns 200 OK { success: true, data: { services: [ ... ] }, meta: {} }
   * @throws 400 Bad Request (Invalid categoryId UUID query param)
   * @throws 401 Unauthorized
   */
  getServices = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);

    // Parse query params for filtering
    const options: { categoryId?: string; includeInactive?: boolean } = {};
    if (req.query.categoryId) {
      options.categoryId = getUuidQuery(req, 'categoryId');
    }
    if (req.query.includeInactive === 'true') {
      options.includeInactive = true;
    }

    const services = await this.getServicesUseCase.execute(businessId, options);

    res.status(200).json({
      success: true,
      data: { services: services.map((s) => s.toPrimitives()) },
      meta: {},
    });
  };

  /**
   * Updates an existing service's catalog attributes.
   *
   * @http PATCH /api/v1/businesses/:businessId/services/:serviceId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :serviceId (UUID)
   * @body
   *   - Partial<UpdateServiceDto>
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('service.update')
   *          -> ServiceController.updateService
   *          -> validateBody(updateServiceSchema)
   *          -> UpdateServiceUseCase.execute(businessId, serviceId, data)
   *          -> ServiceRepository.update
   *
   * @returns 200 OK { success: true, data: { service: { ... } }, meta: {} }
   * @throws 400 Bad Request
   * @throws 404 Not Found
   */
  updateService = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const serviceId = getUuidParam(req, 'serviceId');
    const data = validateBody(updateServiceSchema, req.body, 'Invalid service update data');

    const service = await this.updateServiceUseCase.execute(businessId, serviceId, data);

    res.status(200).json({
      success: true,
      data: { service: service.toPrimitives() },
      meta: {},
    });
  };

  /**
   * Deactivates (soft-disables) a service in the catalog.
   *
   * @http DELETE /api/v1/businesses/:businessId/services/:serviceId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :serviceId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('service.delete')
   *          -> ServiceController.deactivateService
   *          -> DeactivateServiceUseCase.execute(businessId, serviceId)
   *          -> ServiceRepository.deactivate
   *
   * @returns 204 No Content
   * @throws 404 Not Found
   */
  deactivateService = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const serviceId = getUuidParam(req, 'serviceId');

    await this.deactivateServiceUseCase.execute(businessId, serviceId);

    res.status(204).send();
  };

  // --- Branch Assignments ---

  /**
   * Assigns a service offering to a specific branch in the salon network.
   *
   * @http POST /api/v1/businesses/:businessId/services/:serviceId/branches
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :serviceId (UUID)
   * @body
   *   - branchId: string (UUID)
   *   - isBookable?: boolean
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('service.manage')
   *          -> ServiceController.assignToBranch
   *          -> validateBody(assignBranchSchema)
   *          -> AssignServiceToBranchUseCase.execute
   *          -> ServiceRepository.assignToBranch (upsert)
   *
   * @returns 201 Created { success: true, data: { branchId, serviceId }, meta: {} }
   * @throws 400 Bad Request
   * @throws 403 Forbidden (Branch or service belonging to another tenant)
   * @throws 404 Not Found
   */
  assignToBranch = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const serviceId = getUuidParam(req, 'serviceId');
    const data = validateBody(assignBranchSchema, req.body, 'Invalid branch assignment data');

    await this.assignServiceToBranchUseCase.execute(
      businessId,
      serviceId,
      data.branchId,
      data.isBookable,
    );

    res.status(201).json({
      success: true,
      data: { branchId: data.branchId, serviceId },
      meta: {},
    });
  };

  /**
   * Removes a service offering from a specific branch.
   *
   * @http DELETE /api/v1/businesses/:businessId/services/:serviceId/branches/:branchId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :serviceId (UUID)
   *   - :branchId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('service.manage')
   *          -> ServiceController.unassignFromBranch
   *          -> UnassignServiceFromBranchUseCase.execute
   *          -> ServiceRepository.unassignFromBranch
   *
   * @returns 204 No Content
   * @throws 404 Not Found
   */
  unassignFromBranch = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const serviceId = getUuidParam(req, 'serviceId');
    const branchId = getUuidParam(req, 'branchId');

    await this.unassignServiceFromBranchUseCase.execute(businessId, serviceId, branchId);

    res.status(204).send();
  };

  /**
   * Returns all branch assignments for a service.
   *
   * @http GET /api/v1/businesses/:businessId/services/:serviceId/branches
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :serviceId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware
   *          -> ServiceController.getBranchAssignments
   *          -> GetServiceBranchAssignmentsUseCase.execute
   *          -> ServiceRepository.getBranchAssignments
   *
   * @returns 200 OK { success: true, data: { assignments: [ ... ] }, meta: {} }
   * @throws 404 Not Found
   */
  getBranchAssignments = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = getTenantContext(req);
    const serviceId = getUuidParam(req, 'serviceId');

    const assignments = await this.getServiceBranchAssignmentsUseCase.execute(
      businessId,
      serviceId,
    );

    res.status(200).json({
      success: true,
      data: { assignments },
      meta: {},
    });
  };
}
