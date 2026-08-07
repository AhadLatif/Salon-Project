import { z } from '@salon/validation';

export const registerUserSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(100).openapi({ example: 'John' }),

    lastName: z.string().min(1, 'Last name is required').max(100).openapi({ example: 'Doe' }),

    email: z.email('Invalid email format').max(320).openapi({ example: 'john.doe@example.com' }),

    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .openapi({ example: 'SecureP@ssw0rd2026' }),
  })
  .openapi('RegisterUserDto');

export type RegisterUserDto = z.infer<typeof registerUserSchema>;
