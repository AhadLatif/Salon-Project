import { z } from '@salon/validation';

export const cancelAppointmentSchema = z.object({
  cancellationReason: z
    .string()
    .trim()
    .max(1000, 'Cancellation reason cannot exceed 1000 characters')
    .nullable()
    .optional(),
});

export type CancelAppointmentDto = z.input<typeof cancelAppointmentSchema>;
