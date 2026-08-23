import { z } from '@salon/validation';

export const createCustomerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(200),
    lastName: z.string().trim().max(200).nullable().optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Phone number must be a valid E.164 format')
      .nullable()
      .optional(),
    email: z.string().trim().email('Invalid email address').max(255).nullable().optional(),
    gender: z
      .enum(['male', 'female', 'other', 'prefer_not_to_say'])
      .default('prefer_not_to_say')
      .optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
      .refine((val) => {
        const [year, month, day] = val.split('-').map(Number);
        if (!year || !month || !day) return false;
        const date = new Date(Date.UTC(year, month - 1, day));
        return (
          date.getUTCFullYear() === year &&
          date.getUTCMonth() === month - 1 &&
          date.getUTCDate() === day
        );
      }, 'Date of birth must be a valid calendar date')
      .nullable()
      .optional(),
    marketingOptIn: z.boolean().default(false).optional(),
    userId: z.uuid().nullable().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        (data.email && data.email.length > 0) || (data.phoneNumber && data.phoneNumber.length > 0),
      ),
    {
      message: 'At least one contact method (email or phone number) must be provided',
      path: ['email'],
    },
  );

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
