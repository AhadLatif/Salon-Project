import { z } from '@salon/validation';

export const listAppointmentsQuerySchema = z.object({
  branchId: z.uuid('Invalid branch ID format').optional(),
  staffMemberId: z.uuid('Invalid staff member ID format').optional(),
  businessCustomerId: z.uuid('Invalid customer ID format').optional(),
  status: z
    .enum([
      'pending',
      'confirmed',
      'checked_in',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
    ])
    .optional(),
  startDate: z
    .string()
    .datetime({ message: 'startDate must be a valid ISO 8601 string' })
    .transform((val) => new Date(val))
    .optional(),
  endDate: z
    .string()
    .datetime({ message: 'endDate must be a valid ISO 8601 string' })
    .transform((val) => new Date(val))
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export type ListAppointmentsQueryDto = z.input<typeof listAppointmentsQuerySchema>;
