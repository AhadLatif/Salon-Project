// packages/modules/identity/src/api/dtos/register-user.dto.ts

import { z } from 'zod';

export const registerUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.email('Invalid email format').max(320),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
