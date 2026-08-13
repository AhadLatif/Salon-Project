import { ForbiddenError, ValidationError } from '@salon/shared';
import { z } from '@salon/validation';
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

declare global {
  namespace Express {
    interface Request {
      tenant?: {
        businessId: string;
        memberId: string;
        roleId: string;
      };
    }
  }
}

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

  private validateTenantConsistency(req: Request): string {
    const routeBusinessId = (req.params as Record<string, string>).id;
    const userBusinessId = req.tenant?.businessId;

    if (!userBusinessId || routeBusinessId !== userBusinessId) {
      throw new ForbiddenError('You do not have access to this business context');
    }
    return routeBusinessId;
  }

  private parseUuidParam(paramValue: string, paramName: string): string {
    const uuidSchema = z.string().uuid();
    const result = uuidSchema.safeParse(paramValue);
    if (!result.success) {
      throw new ValidationError(`Invalid ${paramName} format`);
    }
    return result.data;
  }

  private formatZodErrors(error: z.ZodError): Record<string, string> {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const fieldName = issue.path.join('.') || '_root';
      fieldErrors[fieldName] = issue.message;
    }
    return fieldErrors;
  }

  createService = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);

    const parseResult = createServiceSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid service data', this.formatZodErrors(parseResult.error));
    }

    const service = await this.createServiceUseCase.execute({
      ...parseResult.data,
      businessId,
    });

    res.status(201).json({
      success: true,
      data: { service: service.toPrimitives() },
      meta: {},
    });
  };

  getServiceById = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);
    const serviceId = this.parseUuidParam(req.params.serviceId as string, 'serviceId');

    const service = await this.getServiceByIdUseCase.execute(businessId, serviceId);

    res.status(200).json({
      success: true,
      data: { service: service.toPrimitives() },
      meta: {},
    });
  };

  getServices = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);

    // Parse query params for filtering
    const options: { categoryId?: string; includeInactive?: boolean } = {};
    if (req.query.categoryId) {
      options.categoryId = this.parseUuidParam(
        req.query.categoryId as string,
        'categoryId query param',
      );
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

  updateService = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);
    const serviceId = this.parseUuidParam(req.params.serviceId as string, 'serviceId');

    const parseResult = updateServiceSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(
        'Invalid service update data',
        this.formatZodErrors(parseResult.error),
      );
    }

    const service = await this.updateServiceUseCase.execute(
      businessId,
      serviceId,
      parseResult.data,
    );

    res.status(200).json({
      success: true,
      data: { service: service.toPrimitives() },
      meta: {},
    });
  };

  deactivateService = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);
    const serviceId = this.parseUuidParam(req.params.serviceId as string, 'serviceId');

    await this.deactivateServiceUseCase.execute(businessId, serviceId);

    res.status(204).send();
  };

  // --- Branch Assignments ---

  assignToBranch = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);
    const serviceId = this.parseUuidParam(req.params.serviceId as string, 'serviceId');

    const parseResult = assignBranchSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(
        'Invalid branch assignment data',
        this.formatZodErrors(parseResult.error),
      );
    }

    await this.assignServiceToBranchUseCase.execute(
      businessId,
      serviceId,
      parseResult.data.branchId,
      parseResult.data.isBookable,
    );

    res.status(201).json({
      success: true,
      data: { branchId: parseResult.data.branchId, serviceId },
      meta: {},
    });
  };

  unassignFromBranch = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);
    const serviceId = this.parseUuidParam(req.params.serviceId as string, 'serviceId');
    const branchId = this.parseUuidParam(req.params.branchId as string, 'branchId');

    await this.unassignServiceFromBranchUseCase.execute(businessId, serviceId, branchId);

    res.status(204).send();
  };

  getBranchAssignments = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);
    const serviceId = this.parseUuidParam(req.params.serviceId as string, 'serviceId');

    const assignments = await this.getServiceBranchAssignmentsUseCase.execute(
      businessId,
      serviceId,
    );

    res.status(200).json({
      success: true,
      data: { serviceId, assignments },
      meta: {},
    });
  };
}
