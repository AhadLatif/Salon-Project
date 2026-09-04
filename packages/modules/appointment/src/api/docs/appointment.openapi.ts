import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';
import { createAppointmentSchema } from '../dtos/create-appointment.schema.js';

export const appointmentOpenApiRegistry = new OpenAPIRegistry();

appointmentOpenApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const errorSchema = z.object({
  code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
  message: z.string().openapi({ example: 'Invalid request data' }),
  details: z.record(z.string(), z.string()).optional(),
});

const successEnvelopeSchema = <
  T extends z.ZodTypeAny,
  M extends z.ZodTypeAny = z.ZodObject<Record<string, never>>,
>(
  dataSchema: T,
  metaSchema: M = z.object({}) as unknown as M,
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

const appointmentSegmentResponseSchema = z
  .object({
    id: z.uuid(),
    appointmentId: z.uuid(),
    serviceId: z.uuid(),
    staffMemberId: z.uuid(),
    serviceName: z.string(),
    staffName: z.string(),
    unitPrice: z.string(),
    durationMinutes: z.number(),
    processingTimeMinutes: z.number(),
    extraTimeMinutes: z.number(),
    bufferBeforeMinutes: z.number(),
    bufferAfterMinutes: z.number(),
    startsAt: z.date(),
    endsAt: z.date(),
    sequence: z.number(),
    notes: z.string().nullable(),
  })
  .openapi('AppointmentSegment');

const appointmentResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    branchId: z.uuid(),
    businessCustomerId: z.uuid(),
    status: z.enum([
      'pending',
      'confirmed',
      'checked_in',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
    ]),
    bookingChannel: z.enum(['marketplace', 'business_dashboard', 'walk_in']),
    scheduledStartAt: z.date(),
    scheduledEndAt: z.date(),
    createdByUserId: z.uuid().nullable(),
    createdByBusinessMemberId: z.uuid().nullable(),
    segments: z.array(appointmentSegmentResponseSchema),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi('Appointment');

appointmentOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/appointments',
  summary: 'Book a new appointment',
  description:
    'Atomically creates an appointment with one or more service segments. Reserves staff calendar allocations with double-booking prevention.',
  tags: ['Appointments'],
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'businessId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Business tenant UUID',
    },
    {
      name: 'x-business-id',
      in: 'header',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Active tenant business UUID',
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createAppointmentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Appointment booked successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ appointment: appointmentResponseSchema })),
        },
      },
    },
    400: {
      description: 'Validation failure',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - insufficient permissions or tenant mismatch',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
    404: {
      description: 'Resource not found',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
    409: {
      description: 'Conflict - time slot unavailable or double booking detected',
      content: {
        'application/json': {
          schema: failureEnvelopeSchema,
        },
      },
    },
  },
});

appointmentOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/appointments/{appointmentId}',
  summary: 'Retrieve appointment details',
  description: 'Fetches appointment aggregate including all service segments.',
  tags: ['Appointments'],
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'businessId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    {
      name: 'appointmentId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    {
      name: 'x-business-id',
      in: 'header',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
  ],
  responses: {
    200: {
      description: 'Appointment details',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ appointment: appointmentResponseSchema })),
        },
      },
    },
    404: {
      description: 'Appointment not found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

appointmentOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/appointments',
  summary: 'List appointments',
  description: 'Queries tenant appointments with filtering by branch, customer, status, and dates.',
  tags: ['Appointments'],
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'businessId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    {
      name: 'x-business-id',
      in: 'header',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    { name: 'branchId', in: 'query', schema: { type: 'string', format: 'uuid' } },
    { name: 'status', in: 'query', schema: { type: 'string' } },
    { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
    { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
  ],
  responses: {
    200: {
      description: 'List of appointments with pagination metadata',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({ appointments: z.array(appointmentResponseSchema) }),
            z.object({
              total: z
                .number()
                .int()
                .openapi({ description: 'Total matching appointments', example: 42 }),
              limit: z.number().int().openapi({ description: 'Page size', example: 50 }),
              offset: z.number().int().openapi({ description: 'Page offset', example: 0 }),
            }),
          ),
        },
      },
    },
  },
});

appointmentOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/appointments/availability',
  summary: 'Query available booking slots',
  description:
    'Computes open booking slots on a date considering branch opening hours, staff shifts, staff time off, and active bookings.',
  tags: ['Appointments'],
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'businessId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    {
      name: 'x-business-id',
      in: 'header',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    { name: 'branchId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
    { name: 'serviceId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
    {
      name: 'date',
      in: 'query',
      required: true,
      schema: { type: 'string', example: '2030-06-15' },
    },
    { name: 'staffMemberId', in: 'query', schema: { type: 'string', format: 'uuid' } },
  ],
  responses: {
    200: {
      description: 'List of available time slots',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(
            z.object({
              slots: z.array(
                z.object({
                  startsAt: z.date(),
                  endsAt: z.date(),
                  staffMemberId: z.uuid(),
                }),
              ),
            }),
            z.object({
              totalSlots: z
                .number()
                .int()
                .openapi({ description: 'Total available slots on this date', example: 8 }),
              date: z
                .string()
                .openapi({ description: 'Date queried (YYYY-MM-DD)', example: '2030-06-15' }),
            }),
          ),
        },
      },
    },
  },
});

appointmentOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/appointments/{appointmentId}/status',
  summary: 'Transition appointment lifecycle status',
  description:
    'Transitions status following the FSM rules (confirmed -> checked_in -> in_progress -> completed/no_show).',
  tags: ['Appointments'],
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'businessId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    {
      name: 'appointmentId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    {
      name: 'x-business-id',
      in: 'header',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['confirmed', 'checked_in', 'in_progress', 'completed', 'no_show']),
            reason: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Appointment status updated',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ appointment: appointmentResponseSchema })),
        },
      },
    },
    409: {
      description: 'Invalid status transition according to state machine',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

appointmentOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/appointments/{appointmentId}/cancel',
  summary: 'Cancel appointment',
  description: 'Cancels appointment and atomically frees occupied staff allocations.',
  tags: ['Appointments'],
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'businessId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    {
      name: 'appointmentId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    {
      name: 'x-business-id',
      in: 'header',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            cancellationReason: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Appointment cancelled and slot freed',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ appointment: appointmentResponseSchema })),
        },
      },
    },
    409: {
      description: 'Cannot cancel appointment in terminal status',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

appointmentOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/appointments/{appointmentId}/reschedule',
  summary: 'Reschedule appointment',
  description: 'Atomically verifies slot availability and swaps appointment allocations.',
  tags: ['Appointments'],
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'businessId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    {
      name: 'appointmentId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
    {
      name: 'x-business-id',
      in: 'header',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            scheduledStartAt: z.string(),
            reason: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Appointment rescheduled successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.object({ appointment: appointmentResponseSchema })),
        },
      },
    },
    409: {
      description: 'Requested time slot is occupied or appointment is in terminal status',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});
