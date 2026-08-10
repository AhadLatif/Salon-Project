import { z } from '@salon/validation';

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, 'Role name is required'),
  description: z.string().trim().nullable().optional(),
  permissions: z.array(z.string().trim()).optional(),
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;
