import { z } from '@salon/validation';

export const getAvailabilityQuerySchema = z.object({
  branchId: z.uuid('Invalid branch ID format'),
  serviceId: z.uuid('Invalid service ID format'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .refine((val) => {
      // Reject impossible months and days by parsing through Date and confirming it round-trips.
      // e.g. 2024-02-30 would produce a March date, so the month/day would not match the input.
      const parts = val.split('-').map(Number);
      const year = parts[0] ?? 0;
      const month = parts[1] ?? 0;
      const day = parts[2] ?? 0;
      const d = new Date(Date.UTC(year, month - 1, day));
      return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
    }, 'Date is not a valid calendar date (impossible day or month)'),
  staffMemberId: z.uuid('Invalid staff member ID format').optional(),
});

export type GetAvailabilityQueryDto = z.input<typeof getAvailabilityQuerySchema>;
