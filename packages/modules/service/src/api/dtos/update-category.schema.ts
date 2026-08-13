import { z } from '@salon/validation';

export const updateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Category name is required')
      .max(100, 'Name too long')
      .optional(),
    description: z.string().trim().max(500, 'Description too long').nullable().optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => {
      const { name, description, displayOrder } = data;
      return name !== undefined || description !== undefined || displayOrder !== undefined;
    },
    { message: 'At least one field must be provided for update' },
  );
