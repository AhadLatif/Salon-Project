import { z } from '@salon/validation';

export const assignBranchSchema = z.object({
  branchId: z.string().uuid('Invalid branchId format'),
  isBookable: z.boolean().optional().default(true),
});
