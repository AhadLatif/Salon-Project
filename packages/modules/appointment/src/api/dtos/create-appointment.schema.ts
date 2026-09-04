import { z } from '@salon/validation';

export const createAppointmentSegmentSchema = z.object({
  serviceId: z.uuid('Invalid service ID format'),
  staffMemberId: z.uuid('Invalid staff member ID format'),
  overrideDurationMinutes: z.number().int().positive('Duration must be positive').optional(),
  notes: z.string().trim().max(1000, 'Notes must not exceed 1000 characters').nullable().optional(),
});

export const createAppointmentSchema = z.object({
  branchId: z.uuid('Invalid branch ID format'),
  businessCustomerId: z.uuid('Invalid customer ID format'),
  scheduledStartAt: z
    .string()
    .datetime({ message: 'Must be a valid ISO 8601 date-time string' })
    .transform((val) => new Date(val)),
  bookingChannel: z
    .enum(['marketplace', 'business_dashboard', 'walk_in'])
    .default('business_dashboard'),
  segments: z
    .array(createAppointmentSegmentSchema)
    .min(1, 'At least one service segment is required'),
});

export type CreateAppointmentSegmentDto = z.input<typeof createAppointmentSegmentSchema>;
export type CreateAppointmentDto = z.input<typeof createAppointmentSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
