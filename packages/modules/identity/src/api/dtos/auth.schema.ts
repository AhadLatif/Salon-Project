import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Invalid email format').max(320),
  password: z.string().min(1, 'Password is required'),
  deviceName: z.string().max(255).optional(),
  deviceType: z.enum(['desktop', 'mobile', 'tablet', 'unknown']).default('unknown'),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
