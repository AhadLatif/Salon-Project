import {
  ForbiddenError,
  getTenantContext,
  getUuidParam,
  ValidationError,
  validateBody,
  validateQuery,
} from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { CancelAppointmentUseCase } from '../../application/use-cases/cancel-appointment.use-case.js';
import type { CreateAppointmentUseCase } from '../../application/use-cases/create-appointment.use-case.js';
import type { GetAppointmentDetailUseCase } from '../../application/use-cases/get-appointment-detail.use-case.js';
import type { GetAvailabilityUseCase } from '../../application/use-cases/get-availability.use-case.js';
import type { ListAppointmentsUseCase } from '../../application/use-cases/list-appointments.use-case.js';
import type { RescheduleAppointmentUseCase } from '../../application/use-cases/reschedule-appointment.use-case.js';
import type { TransitionAppointmentStatusUseCase } from '../../application/use-cases/transition-appointment-status.use-case.js';
import { cancelAppointmentSchema } from '../dtos/cancel-appointment.schema.js';
import { createAppointmentSchema } from '../dtos/create-appointment.schema.js';
import { getAvailabilityQuerySchema } from '../dtos/get-availability-query.schema.js';
import { listAppointmentsQuerySchema } from '../dtos/list-appointments-query.schema.js';
import { rescheduleAppointmentSchema } from '../dtos/reschedule-appointment.schema.js';
import { transitionStatusSchema } from '../dtos/transition-status.schema.js';

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

export class AppointmentController {
  constructor(
    private readonly createAppointmentUseCase: CreateAppointmentUseCase,
    private readonly getAppointmentDetailUseCase: GetAppointmentDetailUseCase,
    private readonly listAppointmentsUseCase: ListAppointmentsUseCase,
    private readonly cancelAppointmentUseCase: CancelAppointmentUseCase,
    private readonly transitionAppointmentStatusUseCase: TransitionAppointmentStatusUseCase,
    private readonly rescheduleAppointmentUseCase: RescheduleAppointmentUseCase,
    private readonly getAvailabilityUseCase: GetAvailabilityUseCase,
  ) {}

  /**
   * Books a new appointment with one or more service segments.
   *
   * @http POST /api/v1/businesses/:businessId/appointments
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId, memberId, branchId: contextBranchId } = getTenantContext(req);
      const data = validateBody(
        createAppointmentSchema,
        req.body,
        'Invalid appointment booking data',
      );

      if (contextBranchId && data.branchId && data.branchId !== contextBranchId) {
        throw new ValidationError('Branch ID in request body must match x-branch-id header.', {
          branchId: 'Mismatched branch context.',
        });
      }

      const branchId = contextBranchId ?? data.branchId;

      const appointment = await this.createAppointmentUseCase.execute({
        ...data,
        branchId,
        businessId,
        createdByBusinessMemberId: memberId || null,
        createdByUserId: req.user?.userId ?? null,
      });

      res.status(201).json({
        success: true,
        data: { appointment },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves an appointment by ID with all service segments.
   *
   * @http GET /api/v1/businesses/:businessId/appointments/:appointmentId
   */
  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId, branchId } = getTenantContext(req);
      const appointmentId = getUuidParam(req, 'appointmentId');

      const appointment = await this.getAppointmentDetailUseCase.execute(
        businessId,
        appointmentId,
        branchId,
      );

      res.status(200).json({
        success: true,
        data: { appointment },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Queries appointments with filters and pagination.
   *
   * @http GET /api/v1/businesses/:businessId/appointments
   */
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId, branchId } = getTenantContext(req);
      const filters = validateQuery(
        listAppointmentsQuerySchema,
        req.query,
        'Invalid appointment query filters',
      );

      if (branchId && filters.branchId && filters.branchId !== branchId) {
        throw new ForbiddenError('Cannot query appointments for another branch.');
      }

      const effectiveFilters = {
        ...filters,
        ...(branchId ? { branchId } : {}),
      };

      const result = await this.listAppointmentsUseCase.execute(businessId, effectiveFilters);

      res.status(200).json({
        success: true,
        data: { appointments: result.appointments },
        error: null,
        meta: {
          total: result.total,
          limit: filters.limit ?? 50,
          offset: filters.offset ?? 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cancels an existing appointment, freeing staff allocations.
   *
   * @http POST /api/v1/businesses/:businessId/appointments/:appointmentId/cancel
   */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId, memberId, branchId } = getTenantContext(req);
      const appointmentId = getUuidParam(req, 'appointmentId');
      const body = validateBody(
        cancelAppointmentSchema,
        req.body,
        'Invalid cancellation request data',
      );

      const appointment = await this.cancelAppointmentUseCase.execute({
        businessId,
        appointmentId,
        branchId,
        cancellationReason: body.cancellationReason ?? null,
        cancelledByUserId: req.user?.userId ?? null,
        cancelledByBusinessMemberId: memberId || null,
      });

      res.status(200).json({
        success: true,
        data: { appointment },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Transitions an appointment status (e.g. checked_in, in_progress, completed, no_show).
   *
   * @http POST /api/v1/businesses/:businessId/appointments/:appointmentId/status
   */
  async transitionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId, memberId, branchId } = getTenantContext(req);
      const appointmentId = getUuidParam(req, 'appointmentId');
      const body = validateBody(
        transitionStatusSchema,
        req.body,
        'Invalid status transition request data',
      );

      const appointment = await this.transitionAppointmentStatusUseCase.execute({
        businessId,
        appointmentId,
        branchId,
        toStatus: body.status,
        reason: body.reason ?? null,
        actorUserId: req.user?.userId ?? null,
        actorBusinessMemberId: memberId || null,
      });

      res.status(200).json({
        success: true,
        data: { appointment },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reschedules an appointment to a new start time, updating allocations atomically.
   *
   * @http POST /api/v1/businesses/:businessId/appointments/:appointmentId/reschedule
   */
  async reschedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId, memberId, branchId } = getTenantContext(req);
      const appointmentId = getUuidParam(req, 'appointmentId');
      const body = validateBody(
        rescheduleAppointmentSchema,
        req.body,
        'Invalid reschedule request data',
      );

      const appointment = await this.rescheduleAppointmentUseCase.execute({
        businessId,
        appointmentId,
        branchId,
        newScheduledStartAt: body.scheduledStartAt,
        reason: body.reason ?? null,
        actorUserId: req.user?.userId ?? null,
        actorBusinessMemberId: memberId || null,
      });

      res.status(200).json({
        success: true,
        data: { appointment },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Computes available booking slots for a service on a given date.
   *
   * @http GET /api/v1/businesses/:businessId/appointments/availability
   */
  async getAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const query = validateQuery(
        getAvailabilityQuerySchema,
        req.query,
        'Invalid availability query filters',
      );

      const slots = await this.getAvailabilityUseCase.execute({
        businessId,
        branchId: query.branchId,
        serviceId: query.serviceId,
        date: query.date,
        staffMemberId: query.staffMemberId,
      });

      res.status(200).json({
        success: true,
        data: { slots },
        error: null,
        meta: {
          totalSlots: slots.length,
          date: query.date,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
