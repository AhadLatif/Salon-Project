import { z } from '@salon/validation';

export const unassignServiceFromStaffSchema = z.object({
  serviceId: z.string().uuid(),
});

export type UnassignServiceFromStaffDto = z.infer<typeof unassignServiceFromStaffSchema>;
