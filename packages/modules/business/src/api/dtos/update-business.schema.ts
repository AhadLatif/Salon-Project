import { z } from '@salon/validation';

export const updateBusinessSchema = z.object({
  name: z.string().trim().min(1, 'Business name is required').max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  email: z.string().trim().email('Invalid email address').max(320).optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(
      /^\+[1-9]\d{1,14}$/,
      'Phone number must be in E.164 international format (e.g. +1234567890)',
    )
    .optional(),
  socialLinks: z.record(z.string(), z.string()).nullable().optional(),
});

export type UpdateBusinessDto = z.infer<typeof updateBusinessSchema>;
