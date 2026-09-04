/**
 * Appointment module factory.
 *
 * Wires repositories, use-cases, controllers, and Express routers.
 * Follows the modular monolith pattern used across all domain modules.
 */

import type { Database } from '@salon/database';
import { type RequestHandler, Router } from 'express';
import { AppointmentController } from './api/controllers/appointment.controller.js';
import type {
  IBranchValidator,
  IBusinessMemberValidator,
  ICustomerValidator,
  IServiceValidator,
  IStaffValidator,
} from './application/ports/appointment-validators.port.js';
import { CancelAppointmentUseCase } from './application/use-cases/cancel-appointment.use-case.js';
import { CreateAppointmentUseCase } from './application/use-cases/create-appointment.use-case.js';
import { GetAppointmentDetailUseCase } from './application/use-cases/get-appointment-detail.use-case.js';
import { GetAvailabilityUseCase } from './application/use-cases/get-availability.use-case.js';
import { ListAppointmentsUseCase } from './application/use-cases/list-appointments.use-case.js';
import { RescheduleAppointmentUseCase } from './application/use-cases/reschedule-appointment.use-case.js';
import { TransitionAppointmentStatusUseCase } from './application/use-cases/transition-appointment-status.use-case.js';
import { AppointmentRepository } from './infrastructure/repositories/appointment.repository.js';

export * from './api/controllers/index.js';
export * from './api/docs/index.js';
export * from './api/dtos/index.js';
export * from './application/ports/appointment-repository.port.js';
export * from './application/ports/appointment-validators.port.js';
export * from './application/use-cases/index.js';
export * from './domain/entities/index.js';
export * from './domain/services/segment-timing.js';
export * from './infrastructure/repositories/appointment.repository.js';

export interface AppointmentModuleDependencies {
  database: Database;
  authMiddleware: RequestHandler;
  tenantMiddleware: RequestHandler;
  requirePermission: (permissionCode: string) => RequestHandler;
  requireBranchContext: RequestHandler;
  branchValidator: IBranchValidator;
  businessMemberValidator: IBusinessMemberValidator;
  customerValidator: ICustomerValidator;
  serviceValidator: IServiceValidator;
  staffValidator: IStaffValidator;
}

export interface AppointmentModule {
  appointmentRouter: Router;
  useCases: {
    createAppointment: CreateAppointmentUseCase;
    getAppointmentDetail: GetAppointmentDetailUseCase;
    listAppointments: ListAppointmentsUseCase;
    cancelAppointment: CancelAppointmentUseCase;
    transitionStatus: TransitionAppointmentStatusUseCase;
    rescheduleAppointment: RescheduleAppointmentUseCase;
    getAvailability: GetAvailabilityUseCase;
  };
  repos: {
    appointmentRepository: AppointmentRepository;
  };
}

/** Creates the appointment module with all use-cases, controllers, and routers wired. */
export function createAppointmentModule(deps: AppointmentModuleDependencies): AppointmentModule {
  // 1. Repositories
  const appointmentRepository = new AppointmentRepository(deps.database);

  // 2. Use Cases
  const createAppointmentUseCase = new CreateAppointmentUseCase(
    appointmentRepository,
    deps.branchValidator,
    deps.customerValidator,
    deps.staffValidator,
    deps.serviceValidator,
    deps.businessMemberValidator,
  );
  const getAppointmentDetailUseCase = new GetAppointmentDetailUseCase(appointmentRepository);
  const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository);
  const cancelAppointmentUseCase = new CancelAppointmentUseCase(appointmentRepository);
  const transitionAppointmentStatusUseCase = new TransitionAppointmentStatusUseCase(
    appointmentRepository,
  );
  const rescheduleAppointmentUseCase = new RescheduleAppointmentUseCase(
    appointmentRepository,
    deps.branchValidator,
    deps.staffValidator,
    deps.serviceValidator,
  );
  const getAvailabilityUseCase = new GetAvailabilityUseCase(
    appointmentRepository,
    deps.branchValidator,
    deps.serviceValidator,
    deps.staffValidator,
  );

  // 3. Controllers
  const appointmentController = new AppointmentController(
    createAppointmentUseCase,
    getAppointmentDetailUseCase,
    listAppointmentsUseCase,
    cancelAppointmentUseCase,
    transitionAppointmentStatusUseCase,
    rescheduleAppointmentUseCase,
    getAvailabilityUseCase,
  );

  // 4. Routers (mounted at /api/v1/businesses/:businessId/appointments)
  const appointmentRouter = Router({ mergeParams: true });
  appointmentRouter.use(deps.authMiddleware);
  appointmentRouter.use(deps.tenantMiddleware);

  appointmentRouter.post(
    '/',
    deps.requirePermission('appointment.create'),
    deps.requireBranchContext,
    appointmentController.create.bind(appointmentController),
  );
  appointmentRouter.get(
    '/',
    deps.requirePermission('appointment.read'),
    appointmentController.findAll.bind(appointmentController),
  );
  appointmentRouter.get(
    '/availability',
    deps.requirePermission('appointment.read'),
    appointmentController.getAvailability.bind(appointmentController),
  );
  // No requireBranchContext on /:appointmentId routes: the appointment is already scoped
  // to the verified tenant (businessId WHERE clause). Cross-business IDOR is closed by SQL.
  // Within-business branch IDOR for these routes is accepted as a deferred scope item;
  // adding it would require Business B (in IDOR tests) to supply a valid branchId for the
  // header, which it cannot do since it owns no branches.
  appointmentRouter.get(
    '/:appointmentId',
    deps.requirePermission('appointment.read'),
    deps.requireBranchContext,
    appointmentController.findById.bind(appointmentController),
  );
  appointmentRouter.post(
    '/:appointmentId/cancel',
    deps.requirePermission('appointment.cancel'),
    deps.requireBranchContext,
    appointmentController.cancel.bind(appointmentController),
  );
  appointmentRouter.post(
    '/:appointmentId/status',
    deps.requirePermission('appointment.update'),
    deps.requireBranchContext,
    appointmentController.transitionStatus.bind(appointmentController),
  );
  appointmentRouter.post(
    '/:appointmentId/reschedule',
    deps.requirePermission('appointment.update'),
    deps.requireBranchContext,
    appointmentController.reschedule.bind(appointmentController),
  );

  return {
    appointmentRouter,
    useCases: {
      createAppointment: createAppointmentUseCase,
      getAppointmentDetail: getAppointmentDetailUseCase,
      listAppointments: listAppointmentsUseCase,
      cancelAppointment: cancelAppointmentUseCase,
      transitionStatus: transitionAppointmentStatusUseCase,
      rescheduleAppointment: rescheduleAppointmentUseCase,
      getAvailability: getAvailabilityUseCase,
    },
    repos: {
      appointmentRepository,
    },
  };
}
