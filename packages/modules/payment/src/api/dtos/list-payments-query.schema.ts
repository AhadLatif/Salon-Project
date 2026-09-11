import { z } from '@salon/validation';

export const listPaymentsQuerySchema = z.object({
  status: z.enum(['unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded']).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ListPaymentsQueryDto = z.input<typeof listPaymentsQuerySchema>;
