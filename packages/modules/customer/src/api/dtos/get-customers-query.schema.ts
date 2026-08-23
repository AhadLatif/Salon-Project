import { z } from '@salon/validation';

export const getCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['active', 'blocked', 'archived']).optional(),
  tagId: z.uuid().optional(),
});

export type GetCustomersQueryDto = z.infer<typeof getCustomersQuerySchema>;
