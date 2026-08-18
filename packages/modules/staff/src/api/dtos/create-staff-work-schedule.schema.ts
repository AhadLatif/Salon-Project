import { z } from '@salon/validation';

export const createStaffWorkScheduleSchema = z.object({
  recurrencePattern: z.enum(['weekly', 'biweekly', 'triweekly', 'four_weekly']),
  branchId: z.uuid(),
  // HTTP JSON bodies carry dates as ISO-8601 strings (e.g. "2026-01-01").
  // The use case and repository operate on strings; the DB `date` column maps to string via Drizzle.
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format'),
  effectiveUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format')
    .nullable()
    .optional(),
});

export type CreateStaffWorkScheduleDto = z.infer<typeof createStaffWorkScheduleSchema>;
