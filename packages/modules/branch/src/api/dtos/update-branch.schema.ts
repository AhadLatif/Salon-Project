import { z } from '@salon/validation';

export const updateBranchSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    phoneNumber: z.string().trim().max(50).nullable().optional(),
    email: z.email().trim().max(255).nullable().optional(),
    timezone: z.string().trim().max(100).optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/i, 'Currency must be a 3-letter ISO code')
      .optional(),
    addressLine1: z.string().trim().min(1).max(255).optional(),
    addressLine2: z.string().trim().max(255).nullable().optional(),
    city: z.string().trim().min(1).max(100).optional(),
    state: z.string().trim().max(100).nullable().optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/i, 'Country code must be a 2-letter ISO code')
      .optional(),
    latitude: z
      .string()
      .regex(/^-?\d{1,2}(\.\d+)?$/)
      .refine(
        (val) => {
          const num = parseFloat(val);
          return num >= -90 && num <= 90;
        },
        { message: 'Latitude must be between -90 and 90' },
      )
      .nullable()
      .optional(),
    longitude: z
      .string()
      .regex(/^-?\d{1,3}(\.\d+)?$/)
      .refine(
        (val) => {
          const num = parseFloat(val);
          return num >= -180 && num <= 180;
        },
        { message: 'Longitude must be between -180 and 180' },
      )
      .nullable()
      .optional(),
    status: z.enum(['active', 'inactive', 'archived']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });
