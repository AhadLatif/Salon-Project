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
