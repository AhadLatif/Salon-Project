import { z } from '@salon/validation';

export const unassignServiceFromStaffSchema = z.object({
  serviceId: z.uuid(),
});

export type UnassignServiceFromStaffDto = z.infer<typeof unassignServiceFromStaffSchema>;
