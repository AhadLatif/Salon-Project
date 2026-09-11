import { z } from '@salon/validation';

const MONEY = /^\d+(?:\.\d{1,2})?$/;

export const recordCashRefundSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(MONEY, 'Amount must be a decimal with up to 2 decimal places (e.g. "125.50")'),
  reason: z.string().trim().max(1000, 'Reason cannot exceed 1000 characters').nullable().optional(),
});

export type RecordCashRefundBodyDto = z.input<typeof recordCashRefundSchema>;
