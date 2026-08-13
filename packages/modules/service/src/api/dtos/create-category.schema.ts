import { z } from '@salon/validation';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100, 'Name too long'),
  description: z.string().trim().max(500, 'Description too long').nullable().optional(),
  displayOrder: z.number().int().min(0).optional().default(0),
});
