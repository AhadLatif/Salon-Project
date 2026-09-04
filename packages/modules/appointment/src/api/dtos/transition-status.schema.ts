import { z } from '@salon/validation';

export const transitionStatusSchema = z.object({
  status: z.enum(['confirmed', 'checked_in', 'in_progress', 'completed', 'no_show']),
  reason: z
    .string()
    .trim()
    .max(1000, 'Status transition reason cannot exceed 1000 characters')
    .nullable()
    .optional(),
});

export type TransitionStatusDto = z.input<typeof transitionStatusSchema>;
