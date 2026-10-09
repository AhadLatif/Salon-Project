import { z } from '@salon/validation';

export const publicBranchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: z.string(),
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
  timezone: z.string(),
  currency: z.string(),
});

export const publicBusinessProfileSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  socialLinks: z.record(z.string(), z.string()).nullable(),
  branches: z.array(publicBranchSchema),
});

// Query params for public business browsing with a hard cap of 50 per page
export const businessListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type BusinessListQuery = z.infer<typeof businessListQuerySchema>;
