import { z } from '@salon/validation';

export const createServiceSchema = z.object({
  categoryId: z.string().uuid('Invalid categoryId format'),
  name: z.string().trim().min(1, 'Service name is required').max(150, 'Name too long'),
  description: z.string().trim().max(1000, 'Description too long').nullable().optional(),
  defaultPrice: z
    .string()
    .trim()
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      'Price must be a valid positive number with up to 8 digits and 2 decimal places',
    ),
  defaultDurationMinutes: z.number().int().min(1).max(480), // 8 hours max
  bufferBeforeMinutes: z.number().int().min(0).max(120).optional().default(0),
  bufferAfterMinutes: z.number().int().min(0).max(120).optional().default(0),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex code')
    .nullable()
    .optional(),
  isBookable: z.boolean().optional().default(true),
});
