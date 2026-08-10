import { z } from '@salon/validation';

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.string().trim()),
});

export type UpdateRolePermissionsDto = z.infer<typeof updateRolePermissionsSchema>;
