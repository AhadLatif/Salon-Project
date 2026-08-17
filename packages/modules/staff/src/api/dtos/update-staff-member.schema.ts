import { z } from '@salon/validation';

export const updateStaffMemberSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  biography: z.string().max(2000).nullable().optional(),
  avatarMediaId: z.uuid().nullable().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contractor']).optional(),
  hireDate: z.string().nullable().optional(),
  excludeFromAutoAssignment: z.boolean().optional(),
  languages: z.array(z.string()).nullable().optional(),
  socialLinks: z.record(z.string(), z.string()).nullable().optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
});

export type UpdateStaffMemberDto = z.infer<typeof updateStaffMemberSchema>;
