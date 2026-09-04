import { z } from '@salon/validation';

export const rescheduleAppointmentSchema = z.object({
  scheduledStartAt: z
    .string()
    .datetime({ message: 'Must be a valid ISO 8601 date-time string' })
    .transform((val) => new Date(val)),
  reason: z.string().trim().max(1000, 'Reason cannot exceed 1000 characters').nullable().optional(),
});

export type RescheduleAppointmentDto = z.input<typeof rescheduleAppointmentSchema>;
