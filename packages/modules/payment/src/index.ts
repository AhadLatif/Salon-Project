/**
 * Payment module factory.
 *
 * Wires repositories, use-cases, controllers, and Express routers for cash payment
 * capture, viewing, and cash refunds. Cross-module data (appointment snapshots +
 * paid-in-full completion) flows through the injected `IPaymentAppointmentService`
 * — the strict module-isolation invariant: the payment repository only ever SQLs
 * payment-owned tables (payments, payment_transactions, refunds).
 */

import type { Database } from '@salon/database';
import { type RequestHandler, Router } from 'express';
import { PaymentController } from './api/controllers/payment.controller.js';
import type { IPaymentAppointmentService } from './application/ports/appointment-service.port.js';
import type { IBusinessMemberValidator } from './application/ports/business-member-validator.port.js';
import { CaptureCashPaymentUseCase } from './application/use-cases/capture-cash-payment.use-case.js';
import { GetPaymentDetailUseCase } from './application/use-cases/get-payment-detail.use-case.js';
import { ListPaymentsUseCase } from './application/use-cases/list-payments.use-case.js';
import { RecordCashRefundUseCase } from './application/use-cases/record-cash-refund.use-case.js';
import { PaymentRepository } from './infrastructure/repositories/payment.repository.js';

// --- EXPORT ALL CLASSES & TYPES ---
export * from './api/controllers/index.js';
export * from './api/docs/index.js';
export * from './api/dtos/index.js';
export * from './application/ports/appointment-service.port.js';
export * from './application/ports/business-member-validator.port.js';
export * from './application/ports/payment-repository.port.js';
export * from './application/use-cases/index.js';
export * from './domain/entities/index.js';
export * from './domain/services/payment-amount.js';
export * from './infrastructure/repositories/payment.repository.js';

export interface PaymentModuleDependencies {
  database: Database;
  authMiddleware: RequestHandler;
  tenantMiddleware: RequestHandler;
  requirePermission: (permissionCode: string) => RequestHandler;
  requireBranchContext: RequestHandler;
  /** Cross-module appointment service (snapshots + completion) injected by the composition root. */
  appointmentService: IPaymentAppointmentService;
  /** Verifies a business member belongs to the tenant (authorizes captures/refunds). */
  businessMemberValidator: IBusinessMemberValidator;
}

export interface PaymentModule {
  paymentRouter: Router;
  /** Mounted by the composition root at /api/v1/businesses/:businessId/appointments/:appointmentId */
  appointmentPaymentRouter: Router;
  useCases: {
    captureCashPayment: CaptureCashPaymentUseCase;
    recordCashRefund: RecordCashRefundUseCase;
    getPaymentDetail: GetPaymentDetailUseCase;
    listPayments: ListPaymentsUseCase;
  };
  repos: {
    paymentRepository: PaymentRepository;
  };
}

/** Creates the payment module with all use-cases, controllers, and routers wired. */
export function createPaymentModule(deps: PaymentModuleDependencies): PaymentModule {
  // 1. Repositories
  const paymentRepository = new PaymentRepository(deps.database);

  // 2. Use Cases
  const captureCashPaymentUseCase = new CaptureCashPaymentUseCase(
    paymentRepository,
    deps.appointmentService,
    deps.businessMemberValidator,
  );
  const recordCashRefundUseCase = new RecordCashRefundUseCase(
    paymentRepository,
    deps.businessMemberValidator,
  );
  const getPaymentDetailUseCase = new GetPaymentDetailUseCase(paymentRepository);
  const listPaymentsUseCase = new ListPaymentsUseCase(paymentRepository);

  // 3. Controller
  const paymentController = new PaymentController(
    captureCashPaymentUseCase,
    recordCashRefundUseCase,
    getPaymentDetailUseCase,
    listPaymentsUseCase,
  );

  // 4. Router (mounted at /api/v1/businesses/:businessId/payments)
  const paymentRouter = Router({ mergeParams: true });
  paymentRouter.use(deps.authMiddleware);
  paymentRouter.use(deps.tenantMiddleware);

  paymentRouter.get(
    '/',
    deps.requirePermission('payment.read'),
    paymentController.findAll.bind(paymentController),
  );
  paymentRouter.get(
    '/:paymentId',
    deps.requirePermission('payment.read'),
    paymentController.findById.bind(paymentController),
  );
  paymentRouter.post(
    '/:paymentId/refunds',
    deps.requirePermission('payment.refund'),
    paymentController.refund.bind(paymentController),
  );

  // Router for appointment-scoped payment flows, mounted by the composition root
  // at /api/v1/businesses/:businessId/appointments/:appointmentId.
  const appointmentPaymentRouter = Router({ mergeParams: true });
  appointmentPaymentRouter.use(deps.authMiddleware);
  appointmentPaymentRouter.use(deps.tenantMiddleware);
  appointmentPaymentRouter.post(
    '/payments/capture',
    deps.requirePermission('payment.capture'),
    deps.requireBranchContext,
    paymentController.captureCash.bind(paymentController),
  );
  appointmentPaymentRouter.get(
    '/payment',
    deps.requirePermission('payment.read'),
    paymentController.getForAppointment.bind(paymentController),
  );

  return {
    paymentRouter,
    appointmentPaymentRouter,
    useCases: {
      captureCashPayment: captureCashPaymentUseCase,
      recordCashRefund: recordCashRefundUseCase,
      getPaymentDetail: getPaymentDetailUseCase,
      listPayments: listPaymentsUseCase,
    },
    repos: {
      paymentRepository,
    },
  };
}
