import { z } from '@salon/validation';

export const createBusinessSchema = z
  .object({
    name: z.string().trim().min(1, 'Business name is required').max(100),
    slug: z
      .string()
      .trim()
      .min(1, 'Slug is required')
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    email: z.string().trim().email('Invalid email format').max(320),
    phoneNumber: z
      .string()
      .trim()
      .min(1, 'Phone number is required')
      .max(20)
      .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in valid E.164 format (e.g., +1234567890)'),
    description: z.string().trim().max(500).optional().nullable(),
    socialLinks: z.record(z.string(), z.string()).optional().nullable(),
  })
  .openapi('CreateBusinessDto');

export type CreateBusinessDto = z.infer<typeof createBusinessSchema>;
