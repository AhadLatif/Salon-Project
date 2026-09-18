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
import { AppointmentPaymentService } from './application/services/appointment-payment.service.js';
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
export * from './application/ports/appointment-payment-service.port.js';
export * from './application/ports/appointment-repository.port.js';
export * from './application/ports/appointment-validators.port.js';
export * from './application/services/appointment-payment.service.js';
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
  /** Cross-module service consumed by the Payment module for snapshots + paid-in-full completion. */
  paymentService: AppointmentPaymentService;
}

/** Creates the appointment module with all use-cases, controllers, and routers wired. */
export function createAppointmentModule(deps: AppointmentModuleDependencies): AppointmentModule {
  // 1. Repositories
  const appointmentRepository = new AppointmentRepository(deps.database);

  // 1b. Cross-module payment service (read snapshot + complete-as-paid)
  const paymentService = new AppointmentPaymentService(appointmentRepository);

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
  // BRANCH-SCOPED routes: `requireBranchContext` is deliberately applied to every
  // /:appointmentId route, not just the ones that mutate.
  //
  // WHY: without it, a staff member assigned to Branch A could read, cancel, reschedule or
  // transition an appointment belonging to Branch B of the SAME business — a cross-branch IDOR
  // that tenant scoping alone cannot stop, because both appointments share one `businessId`.
  // The middleware resolves `x-branch-id` against the caller's branch access and injects it as
  // `req.tenant.branchId`; the controller forwards it and the repository filters by it, so a
  // cross-branch request fails closed with 404. See BUG-10 in
  // docs/90-shared/10-decisions-history/bug-reports/2026-09-03_appointment_audit.md.
  //
  // A previous comment here claimed these routes were NOT branch-scoped and that the gap was an
  // accepted deferral. That described the vulnerable pre-fix behaviour, and its stated premise
  // was wrong: the IDOR test's own setup creates Business B WITH a branch, so a valid branch id
  // is always available. Concluding from that comment that the middleware should be removed
  // would reopen a Critical finding, so it has been replaced with the reasoning above.
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
    paymentService,
  };
}
