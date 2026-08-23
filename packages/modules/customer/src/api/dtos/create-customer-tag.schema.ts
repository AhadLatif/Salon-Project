import { z } from '@salon/validation';

export const createCustomerTagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name cannot be empty').max(50),
  color: z
    .string()
    .trim()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid 3 or 6 digit hex code')
    .nullable()
    .optional(),
  description: z.string().trim().max(255).nullable().optional(),
});

export type CreateCustomerTagDto = z.infer<typeof createCustomerTagSchema>;
