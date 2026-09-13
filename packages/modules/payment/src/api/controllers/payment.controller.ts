import { getTenantContext, getUuidParam, validateBody, validateQuery } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import type { CaptureCashPaymentUseCase } from '../../application/use-cases/capture-cash-payment.use-case.js';
import type { GetPaymentDetailUseCase } from '../../application/use-cases/get-payment-detail.use-case.js';
import type { ListPaymentsUseCase } from '../../application/use-cases/list-payments.use-case.js';
import type { RecordCashRefundUseCase } from '../../application/use-cases/record-cash-refund.use-case.js';
import { captureCashPaymentSchema } from '../dtos/capture-cash.schema.js';
import { listPaymentsQuerySchema } from '../dtos/list-payments-query.schema.js';
import { recordCashRefundSchema } from '../dtos/record-refund.schema.js';

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

export class PaymentController {
  constructor(
    private readonly captureCashPaymentUseCase: CaptureCashPaymentUseCase,
    private readonly recordCashRefundUseCase: RecordCashRefundUseCase,
    private readonly getPaymentDetailUseCase: GetPaymentDetailUseCase,
    private readonly listPaymentsUseCase: ListPaymentsUseCase,
  ) {}

  /**
   * Records a cash payment against an appointment (Fresha POS "checkout").
   *
   * @http POST /api/v1/businesses/:businessId/appointments/:appointmentId/payments/capture
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   *   - x-branch-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :appointmentId (UUID)
   * @body
   *   - amount?: number (integer minor units / cents; defaults to snapshot total)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('payment.capture') -> requireBranchContext
   *          -> PaymentController.captureCash
   *          -> validateBody(captureCashPaymentSchema)
   *          -> CaptureCashPaymentUseCase.execute
   *          -> PaymentRepository.createPaymentTransaction & AppointmentService.markPaidInFull
   *
   * @returns 201 Created { success: true, data: { payment: { ... } }, error: null, meta: { completed: boolean } }
   * @throws 400 Bad Request (Invalid payment amount or overpayment)
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Cross-tenant IDOR / branch mismatch / invalid actor member)
   * @throws 404 Not Found (Appointment not found)
   * @throws 409 Conflict (Appointment already paid in full)
   */
  async captureCash(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId, memberId, branchId } = getTenantContext(req);
      const appointmentId = getUuidParam(req, 'appointmentId');
      const body = validateBody(captureCashPaymentSchema, req.body, 'Invalid cash payment data');

      const payment = await this.captureCashPaymentUseCase.execute({
        businessId,
        appointmentId,
        branchId,
        amount: body.amount ?? null,
        actorUserId: req.user?.userId ?? null,
        actorBusinessMemberId: memberId || null,
      });

      res.status(201).json({
        success: true,
        data: { payment },
        error: null,
        meta: { completed: payment.status === 'paid' },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Issues a cash refund against a captured payment.
   *
   * @http POST /api/v1/businesses/:businessId/payments/:paymentId/refunds
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :paymentId (UUID)
   * @body
   *   - amount: number (integer minor units / cents; must be > 0 and <= refundable balance)
   *   - reason?: string (max 500 chars)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('payment.refund')
   *          -> PaymentController.refund
   *          -> validateBody(recordCashRefundSchema)
   *          -> RecordCashRefundUseCase.execute
   *          -> PaymentRepository.recordRefund (transaction: insert refund + update payment status)
   *
   * @returns 201 Created { success: true, data: { payment: { ... } }, error: null, meta: {} }
   * @throws 400 Bad Request (Refund amount exceeds refundable balance or illegal status)
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Cross-tenant IDOR / actor not verified member)
   * @throws 404 Not Found (Payment record not found)
   */
  async refund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId, memberId } = getTenantContext(req);
      const paymentId = getUuidParam(req, 'paymentId');
      const body = validateBody(recordCashRefundSchema, req.body, 'Invalid refund data');

      const payment = await this.recordCashRefundUseCase.execute({
        businessId,
        paymentId,
        amount: body.amount,
        reason: body.reason ?? null,
        actorBusinessMemberId: memberId || null,
      });

      res.status(201).json({
        success: true,
        data: { payment },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetches the payment for a specific appointment (one payment per appointment).
   *
   * @http GET /api/v1/businesses/:businessId/appointments/:appointmentId/payment
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :appointmentId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('payment.read')
   *          -> PaymentController.getForAppointment
   *          -> getTenantContext & getUuidParam
   *          -> GetPaymentDetailUseCase.executeByAppointment(businessId, appointmentId)
   *          -> PaymentRepository.findByAppointmentId
   *
   * @returns 200 OK { success: true, data: { payment: { ... } }, error: null, meta: {} }
   * @throws 400 Bad Request (Invalid UUID format)
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Cross-tenant access)
   * @throws 404 Not Found (Payment not found for appointment)
   */
  async getForAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const appointmentId = getUuidParam(req, 'appointmentId');

      const payment = await this.getPaymentDetailUseCase.executeByAppointment(
        businessId,
        appointmentId,
      );
      res.status(200).json({
        success: true,
        data: { payment },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetches a single payment aggregate by id.
   *
   * @http GET /api/v1/businesses/:businessId/payments/:paymentId
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   *   - :paymentId (UUID)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('payment.read')
   *          -> PaymentController.findById
   *          -> getTenantContext & getUuidParam
   *          -> GetPaymentDetailUseCase.execute(businessId, paymentId)
   *          -> PaymentRepository.findById
   *
   * @returns 200 OK { success: true, data: { payment: { ... } }, error: null, meta: {} }
   * @throws 400 Bad Request (Invalid UUID format)
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Cross-tenant access)
   * @throws 404 Not Found (Payment record not found)
   */
  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const paymentId = getUuidParam(req, 'paymentId');

      const payment = await this.getPaymentDetailUseCase.execute(businessId, paymentId);
      res.status(200).json({
        success: true,
        data: { payment },
        error: null,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Lists payments for a business with optional status/date filtering + pagination.
   *
   * @http GET /api/v1/businesses/:businessId/payments
   * @headers
   *   - Authorization: Bearer <accessToken>
   *   - x-business-id: <UUID>
   * @params
   *   - :businessId (UUID)
   * @query
   *   - status?: PaymentStatus | PaymentStatus[]
   *   - fromDate?: ISO 8601 date-time
   *   - toDate?: ISO 8601 date-time
   *   - limit?: number (default 50, max 100)
   *   - offset?: number (default 0)
   *
   * @flow
   *   Client -> authMiddleware -> tenantMiddleware -> requirePermission('payment.read')
   *          -> PaymentController.findAll
   *          -> validateQuery(listPaymentsQuerySchema)
   *          -> ListPaymentsUseCase.execute(businessId, filters)
   *          -> PaymentRepository.findAll
   *
   * @returns 200 OK { success: true, data: { payments: [ ... ] }, error: null, meta: { total, limit, offset } }
   * @throws 400 Bad Request (Invalid query parameters)
   * @throws 401 Unauthorized
   * @throws 403 Forbidden (Cross-tenant access)
   */
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessId } = getTenantContext(req);
      const query = validateQuery(
        listPaymentsQuerySchema,
        req.query,
        'Invalid payment list filters',
      );

      const result = await this.listPaymentsUseCase.execute(businessId, {
        status: query.status,
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
        limit: query.limit,
        offset: query.offset,
      });

      res.status(200).json({
        success: true,
        data: { payments: result.payments },
        error: null,
        meta: { total: result.total, limit: query.limit ?? 50, offset: query.offset ?? 0 },
      });
    } catch (err) {
      next(err);
    }
  }
}
