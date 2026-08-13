import { z } from '@salon/validation';

export const updateServiceSchema = z
  .object({
    categoryId: z.string().uuid('Invalid categoryId format').optional(),
    name: z.string().trim().min(1, 'Service name is required').max(150, 'Name too long').optional(),
    description: z.string().trim().max(1000, 'Description too long').nullable().optional(),
    defaultPrice: z
      .string()
      .trim()
      .regex(
        /^\d{1,8}(\.\d{1,2})?$/,
        'Price must be a valid positive number with up to 8 digits and 2 decimal places',
      )
      .optional(),
    defaultDurationMinutes: z.number().int().min(1).max(480).optional(),
    bufferBeforeMinutes: z.number().int().min(0).max(120).optional(),
    bufferAfterMinutes: z.number().int().min(0).max(120).optional(),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex code')
      .nullable()
      .optional(),
    isBookable: z.boolean().optional(),
  })
  .refine(
    (data) => {
      return Object.values(data).some((value) => value !== undefined);
    },
    { message: 'At least one field must be provided for update' },
  );
