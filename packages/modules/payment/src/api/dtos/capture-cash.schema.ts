import { z } from '@salon/validation';

const MONEY = /^\d+(?:\.\d{1,2})?$/;

export const captureCashPaymentSchema = z.object({
  /**
   * Optional client-paid cash amount (positive, up to 2 dp). When omitted the full
   * outstanding balance for the appointment is captured. The TOTAL is never accepted
   * from the client — it is always derived from the appointment's service unit prices.
   */
  amount: z
    .string()
    .trim()
    .regex(MONEY, 'Amount must be a decimal with up to 2 decimal places (e.g. "125.50")')
    .refine((val) => val === undefined || Number(val) > 0, 'Amount must be greater than zero.')
    .optional(),
});

export type CaptureCashBodyDto = z.input<typeof captureCashPaymentSchema>;
