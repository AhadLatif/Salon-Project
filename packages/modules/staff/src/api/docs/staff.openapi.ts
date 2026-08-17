import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '@salon/validation';
import { addShiftToScheduleSchema } from '../dtos/add-shift-to-schedule.schema.js';
import { assignServiceToStaffSchema } from '../dtos/assign-service-to-staff.schema.js';
import { assignStaffToBranchSchema } from '../dtos/assign-staff-to-branch.schema.js';
import { createStaffMemberSchema } from '../dtos/create-staff-member.schema.js';
import { createStaffWorkScheduleSchema } from '../dtos/create-staff-work-schedule.schema.js';
import { updateStaffMemberSchema } from '../dtos/update-staff-member.schema.js';

export const staffOpenApiRegistry = new OpenAPIRegistry();

staffOpenApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const errorDetailsSchema = z.record(z.string(), z.string());
const errorSchema = z.object({
  code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
  message: z.string().openapi({ example: 'Invalid staff member data' }),
  details: errorDetailsSchema,
});
const successEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({}),
    error: z.null().optional(),
  });
const failureEnvelopeSchema = z.object({
  success: z.literal(false),
  error: errorSchema,
  data: z.null(),
  meta: z.object({}),
});

const staffResponseSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    businessMemberId: z.uuid(),
    displayName: z.string(),
    jobTitle: z.string().nullable(),
    biography: z.string().nullable(),
    avatarMediaId: z.string().nullable(),
    employmentType: z.enum(['full_time', 'part_time', 'contractor']),
    hireDate: z.string().nullable(),
    excludeFromAutoAssignment: z.boolean(),
    languages: z.array(z.string()).nullable(),
    socialLinks: z.record(z.string(), z.string()).nullable(),
    status: z.enum(['active', 'terminated']),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('StaffMember');

const staffBranchAssignmentSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    staffMemberId: z.uuid(),
    branchId: z.uuid(),
    isPrimary: z.boolean(),
    assignedAt: z.string().datetime(),
    unassignedAt: z.string().datetime().nullable(),
  })
  .openapi('StaffBranchAssignment');

const staffServiceAssignmentSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    serviceId: z.uuid(),
    staffMemberId: z.uuid(),
    overridePrice: z.string().nullable(),
    overrideDurationMinutes: z.number().nullable(),
    isBookable: z.boolean(),
  })
  .openapi('StaffServiceAssignment');

const staffWorkScheduleSchema = z
  .object({
    id: z.uuid(),
    businessId: z.uuid(),
    staffMemberId: z.uuid(),
    recurrencePattern: z.enum(['weekly', 'biweekly', 'triweekly', 'four_weekly']),
    effectiveFrom: z.string(),
    effectiveUntil: z.string().nullable(),
  })
  .openapi('StaffWorkSchedule');

const staffScheduleShiftSchema = z
  .object({
    id: z.uuid(),
    workScheduleId: z.uuid(),
    dayOfWeek: z.number().int(),
    startsAt: z.string(),
    endsAt: z.string(),
  })
  .openapi('StaffScheduleShift');

const staffWorkScheduleWithShiftsSchema = staffWorkScheduleSchema.extend({
  shifts: z.array(staffScheduleShiftSchema),
});

// GET /api/v1/businesses/{businessId}/staff
staffOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/staff',
  summary: 'Get all staff members for a business',
  description: 'Retrieves all active staff members for the specified business tenant.',
  tags: ['Staff'],
  request: {
    params: z.object({
      businessId: z.uuid().openapi({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }),
    }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Staff retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.array(staffResponseSchema)),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// GET /api/v1/businesses/{businessId}/staff/{staffMemberId}
staffOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/staff/{staffMemberId}',
  summary: 'Get staff member by ID',
  tags: ['Staff'],
  request: {
    params: z.object({
      businessId: z.uuid(),
      staffMemberId: z.uuid(),
    }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Staff retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(staffResponseSchema), // Add populated schema if needed later
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
    404: {
      description: 'Not Found',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// POST /api/v1/businesses/{businessId}/staff
staffOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/staff',
  summary: 'Create a new staff member',
  tags: ['Staff'],
  request: {
    params: z.object({ businessId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: createStaffMemberSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    201: {
      description: 'Staff member created successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(staffResponseSchema),
        },
      },
    },
    400: {
      description: 'Validation Error',
      content: { 'application/json': { schema: failureEnvelopeSchema } },
    },
  },
});

// PATCH /api/v1/businesses/{businessId}/staff/{staffMemberId}
staffOpenApiRegistry.registerPath({
  method: 'patch',
  path: '/api/v1/businesses/{businessId}/staff/{staffMemberId}',
  summary: 'Update staff member details',
  tags: ['Staff'],
  request: {
    params: z.object({ businessId: z.string().uuid(), staffMemberId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: updateStaffMemberSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Staff updated successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(staffResponseSchema),
        },
      },
    },
  },
});

// DELETE /api/v1/businesses/{businessId}/staff/{staffMemberId}
staffOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{businessId}/staff/{staffMemberId}',
  summary: 'Deactivate a staff member',
  tags: ['Staff'],
  request: {
    params: z.object({ businessId: z.uuid(), staffMemberId: z.uuid() }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Staff deactivated successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.null()),
        },
      },
    },
  },
});

// POST /api/v1/businesses/{businessId}/staff/{staffMemberId}/branches
staffOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/staff/{staffMemberId}/branches',
  summary: 'Assign staff to a branch',
  tags: ['Staff'],
  request: {
    params: z.object({ businessId: z.uuid(), staffMemberId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: assignStaffToBranchSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Assigned successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(staffBranchAssignmentSchema),
        },
      },
    },
  },
});

// DELETE /api/v1/businesses/{businessId}/staff/{staffMemberId}/branches/{branchId}
staffOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{businessId}/staff/{staffMemberId}/branches/{branchId}',
  summary: 'Unassign staff from a branch',
  tags: ['Staff'],
  request: {
    params: z.object({
      businessId: z.uuid(),
      staffMemberId: z.uuid(),
      branchId: z.uuid(),
    }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Unassigned successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.null()),
        },
      },
    },
  },
});

// POST /api/v1/businesses/{businessId}/staff/{staffMemberId}/services
staffOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/staff/{staffMemberId}/services',
  summary: 'Assign service to staff',
  tags: ['Staff'],
  request: {
    params: z.object({ businessId: z.uuid(), staffMemberId: z.uuid() }),
    body: { content: { 'application/json': { schema: assignServiceToStaffSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Assigned successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(staffServiceAssignmentSchema),
        },
      },
    },
  },
});

// DELETE /api/v1/businesses/{businessId}/staff/{staffMemberId}/services/{serviceId}
staffOpenApiRegistry.registerPath({
  method: 'delete',
  path: '/api/v1/businesses/{businessId}/staff/{staffMemberId}/services/{serviceId}',
  summary: 'Unassign service from staff',
  tags: ['Staff'],
  request: {
    params: z.object({
      businessId: z.uuid(),
      staffMemberId: z.uuid(),
      serviceId: z.uuid(),
    }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Unassigned successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.null()),
        },
      },
    },
  },
});

// POST /api/v1/businesses/{businessId}/staff/{staffMemberId}/schedules
staffOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/staff/{staffMemberId}/schedules',
  summary: 'Create staff work schedule',
  tags: ['Staff'],
  request: {
    params: z.object({ businessId: z.uuid(), staffMemberId: z.uuid() }),
    body: { content: { 'application/json': { schema: createStaffWorkScheduleSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    201: {
      description: 'Schedule created successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(staffWorkScheduleSchema),
        },
      },
    },
  },
});

// GET /api/v1/businesses/{businessId}/staff/{staffMemberId}/schedules
staffOpenApiRegistry.registerPath({
  method: 'get',
  path: '/api/v1/businesses/{businessId}/staff/{staffMemberId}/schedules',
  summary: 'Get staff work schedules',
  tags: ['Staff'],
  request: {
    params: z.object({ businessId: z.uuid(), staffMemberId: z.uuid() }),
  },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Schedules retrieved successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(z.array(staffWorkScheduleWithShiftsSchema)),
        },
      },
    },
  },
});

// POST /api/v1/businesses/{businessId}/staff/{staffMemberId}/schedules/{workScheduleId}/shifts
staffOpenApiRegistry.registerPath({
  method: 'post',
  path: '/api/v1/businesses/{businessId}/staff/{staffMemberId}/schedules/{workScheduleId}/shifts',
  summary: 'Add a shift to a schedule',
  tags: ['Staff'],
  request: {
    params: z.object({ businessId: z.uuid(), staffMemberId: z.uuid(), workScheduleId: z.uuid() }),
    body: { content: { 'application/json': { schema: addShiftToScheduleSchema } } },
  },
  security: [{ bearerAuth: [] }],
  responses: {
    201: {
      description: 'Shift added successfully',
      content: {
        'application/json': {
          schema: successEnvelopeSchema(staffScheduleShiftSchema),
        },
      },
    },
  },
});
