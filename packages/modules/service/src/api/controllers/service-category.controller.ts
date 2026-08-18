import { ForbiddenError, ValidationError } from '@salon/shared';
import { z } from '@salon/validation';
import type { Request, Response } from 'express';
import type { CreateCategoryUseCase } from '../../application/use-cases/create-category.use-case.js';
import type { DeactivateCategoryUseCase } from '../../application/use-cases/deactivate-category.use-case.js';
import type { GetCategoriesUseCase } from '../../application/use-cases/get-categories.use-case.js';
import type { UpdateCategoryUseCase } from '../../application/use-cases/update-category.use-case.js';
import { createCategorySchema } from '../dtos/create-category.schema.js';
import { updateCategorySchema } from '../dtos/update-category.schema.js';

declare global {
  namespace Express {
    interface Request {
      tenant?: {
        businessId: string;
        memberId: string;
        roleId: string;
        branchId?: string;
      };
    }
  }
}

export class ServiceCategoryController {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly getCategoriesUseCase: GetCategoriesUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly deactivateCategoryUseCase: DeactivateCategoryUseCase,
  ) {}

  /**
   * Enforces that the :id parameter in the route matches the authenticated user's tenant context.
   */
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

  createCategory = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);

    const parseResult = createCategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid category data', this.formatZodErrors(parseResult.error));
    }

    const category = await this.createCategoryUseCase.execute({
      ...parseResult.data,
      businessId,
    });

    res.status(201).json({
      success: true,
      data: { category: category.toPrimitives() },
      meta: {},
    });
  };

  getCategories = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);

    // Parse query params for filtering
    const includeInactive = req.query.includeInactive === 'true';

    const categories = await this.getCategoriesUseCase.execute(businessId, { includeInactive });

    res.status(200).json({
      success: true,
      data: { categories: categories.map((c) => c.toPrimitives()) },
      meta: {},
    });
  };

  updateCategory = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);
    const categoryId = this.parseUuidParam(req.params.categoryId as string, 'categoryId');

    const parseResult = updateCategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(
        'Invalid category update data',
        this.formatZodErrors(parseResult.error),
      );
    }

    const category = await this.updateCategoryUseCase.execute(
      businessId,
      categoryId,
      parseResult.data,
    );

    res.status(200).json({
      success: true,
      data: { category: category.toPrimitives() },
      meta: {},
    });
  };

  deactivateCategory = async (req: Request, res: Response): Promise<void> => {
    const businessId = this.validateTenantConsistency(req);
    const categoryId = this.parseUuidParam(req.params.categoryId as string, 'categoryId');

    await this.deactivateCategoryUseCase.execute(businessId, categoryId);

    res.status(204).send();
  };
}
