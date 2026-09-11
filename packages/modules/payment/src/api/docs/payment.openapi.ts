import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';

export const paymentOpenApiRegistry = new OpenAPIRegistry();

// Shared path params (declared before use to avoid const TDZ).
const businessIdParam = {
  name: 'businessId',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' } as const,
  description: 'Business tenant UUID',
};
const paymentIdParam = {
  name: 'paymentId',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' } as const,
  description: 'Payment UUID',
};
const appointmentIdParam = {
  name: 'appointmentId',
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' } as const,
  description: 'Appointment UUID',
};
const xBusinessIdHeader = {
  name: 'x-business-id',
  in: 'header' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' } as const,
  description: 'Active tenant business UUID',
};
const xBranchIdHeader = {
  name: 'x-branch-id',
  in: 'header' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' } as const,
  description: 'Branch UUID for branch-scoped access',
};

const errorSchema = z.object({
  code: z.string().openapi({ example: 'CONFLICT' }),
  message: z.string().openapi({ example: 'Payment conflict' }),
  details: z.record(z.string(), z.string()).optional(),
});

const successEnvelopeSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
  metaSchema: z.ZodTypeAny = z.object({}),
) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    error: z.null().optional(),
    meta: metaSchema,
  });

const failureEnvelopeSchema = z.object({
  success: z.literal(false),
  error: errorSchema,
  data: z.null(),
  meta: z.object({}),
});

const moneyString = z.string().openapi({
  type: 'string',
  example: '1250.00',
  description: 'Decimal money with up to 2 decimal places',
});

const transactionResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    appointmentId: z.uuid(),
    businessCustomerId: z.uuid(),
    paymentId: z.uuid(),
    method: z.enum(['cash', 'card', 'online', 'bank_transfer', 'gift_card']),
    status: z.enum(['pending', 'authorized', 'captured', 'failed', 'cancelled']),
    amount: moneyString,
    gateway: z.string().nullable(),
    processedAt: z.date().nullable(),
    createdAt: z.date(),
  })
  .openapi('PaymentTransaction');

const refundResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    paymentTransactionId: z.uuid(),
    status: z.enum(['pending', 'completed', 'failed']),
    amount: moneyString,
    reason: z.string().nullable(),
    processedAt: z.date().nullable(),
    createdAt: z.date(),
  })
  .openapi('PaymentRefund');

const paymentResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    appointmentId: z.uuid(),
    status: z.enum(['unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded']),
    currency: z.string(),
    subtotalAmount: moneyString,
    discountAmount: moneyString,
    taxAmount: moneyString,
    tipAmount: moneyString,
    totalAmount: moneyString,
    paidAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    transactions: z.array(transactionResponseSchema),
    refunds: z.array(refundResponseSchema),
  })
  .openapi('Payment');

const paymentSummarySchema = z
  .object({
    id: z.uuid(),
    appointmentId: z.uuid(),
    status: z.enum(['unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded']),
    currency: z.string(),
    totalAmount: moneyString,
    capturedAmount: moneyString,
    refundedAmount: moneyString,
    paidAt: z.date().nullable(),
    createdAt: z.date(),
  })
  .openapi('PaymentSummary');

paymentOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/appointments/{appointmentId}/payments/capture',
  summary: 'Capture cash payment',
  description:
    'Records a cash payment against an appointment. Total is derived from appointment service prices; only an optional partial amount comes from the client. When fully paid, the appointment is marked completed (Fresha POS checkout).',
  tags: ['Payments'],
  security: [{ bearerAuth: [] }],
  parameters: [businessIdParam, appointmentIdParam, xBusinessIdHeader, xBranchIdHeader],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ amount: z.string().openapi({ example: '1250.00' }).optional() }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Cash payment captured',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({ payment: paymentResponseSchema }),
            z.object({ completed: z.boolean() }),
          ),
        },
      },
    },
    409: {
      description: 'Overpayment, duplicate capture, or terminal appointment',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

paymentOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/payments/{paymentId}/refunds',
  summary: 'Refund a payment',
  description: 'Issues a cash refund against a captured payment.',
  tags: ['Payments'],
  security: [{ bearerAuth: [] }],
  parameters: [businessIdParam, paymentIdParam, xBusinessIdHeader],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            amount: z.string().openapi({ example: '1250.00' }),
            reason: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Refund recorded',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ payment: paymentResponseSchema })),
        },
      },
    },
    409: {
      description: 'Refund exceeds available balance',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

paymentOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/appointments/{appointmentId}/payment',
  summary: 'Get payment for an appointment',
  tags: ['Payments'],
  security: [{ bearerAuth: [] }],
  parameters: [businessIdParam, appointmentIdParam, xBusinessIdHeader],
  responses: {
    200: {
      description: 'Payment aggregate',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ payment: paymentResponseSchema })),
        },
      },
    },
    404: {
      description: 'No payment recorded for this appointment',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

paymentOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/payments',
  summary: 'List payments',
  description: 'Lists payments for a business with status/date filters and pagination.',
  tags: ['Payments'],
  security: [{ bearerAuth: [] }],
  parameters: [
    businessIdParam,
    xBusinessIdHeader,
    {
      name: 'status',
      in: 'query',
      schema: {
        type: 'string',
        enum: ['unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded'],
      },
    },
    { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
    { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date-time' } },
    { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
    { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
  ],
  responses: {
    200: {
      description: 'Paginated payment list',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({ payments: z.array(paymentSummarySchema) }),
            z.object({ total: z.number(), limit: z.number(), offset: z.number() }),
          ),
        },
      },
    },
  },
});
