import { z } from 'zod';

/**
 * Frontend form schemas — intentionally mirror the backend DTOs in
 * `packages/modules/identity/src/api/dtos/*` (zod v4, same as the repo standard):
 * the client validates for feedback, the server remains the authority.
 */
export const loginSchema = z.object({
  email: z.email('Enter a valid email address').max(320),
  password: z.string().min(1, 'Password is required'),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    email: z.email('Enter a valid email address').max(320),
    // Backend enforces min 8 (registerUserSchema); keep the mirror exact.
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type RegisterValues = z.infer<typeof registerSchema>;
