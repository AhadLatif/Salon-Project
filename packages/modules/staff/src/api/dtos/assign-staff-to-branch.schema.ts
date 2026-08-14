import { z } from '@salon/validation';

export const assignStaffToBranchSchema = z.object({
  branchId: z.string().uuid(),
  isPrimary: z.boolean().optional(),
});

export type AssignStaffToBranchDto = z.infer<typeof assignStaffToBranchSchema>;
