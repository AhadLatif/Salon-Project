import { z } from '@salon/validation';

export const createStaffWorkScheduleSchema = z.object({
  recurrencePattern: z.enum(['weekly', 'biweekly', 'triweekly', 'four_weekly']),
  effectiveFrom: z.string(), // Consider custom date string regex if needed
  effectiveUntil: z.string().nullable().optional(),
});

export type CreateStaffWorkScheduleDto = z.infer<typeof createStaffWorkScheduleSchema>;
