import { z } from '@salon/validation';

export const assignServiceToStaffSchema = z.object({
  serviceId: z.string().uuid(),
  overridePrice: z.string().nullable().optional(),
  overrideDurationMinutes: z.number().int().min(1).nullable().optional(),
  isBookable: z.boolean().optional(),
});

export type AssignServiceToStaffDto = z.infer<typeof assignServiceToStaffSchema>;
