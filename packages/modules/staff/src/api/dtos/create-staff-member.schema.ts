import { z } from '@salon/validation';

export const createStaffMemberSchema = z.object({
  businessId: z.string().uuid(),
  businessMemberId: z.string().uuid(),
  displayName: z.string().min(1).max(200),
  jobTitle: z.string().max(100).nullable().optional(),
  biography: z.string().max(2000).nullable().optional(),
  avatarMediaId: z.string().uuid().nullable().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contractor']).optional(),
  hireDate: z.string().nullable().optional(),
  excludeFromAutoAssignment: z.boolean().optional(),
  languages: z.array(z.string()).nullable().optional(),
  socialLinks: z.record(z.string(), z.string()).nullable().optional(),
});

export type CreateStaffMemberDto = z.infer<typeof createStaffMemberSchema>;
