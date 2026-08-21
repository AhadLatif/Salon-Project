import { z } from '@salon/validation';

export const createStaffMemberSchema = z.object({
  businessId: z.uuid(),
  businessMemberId: z.uuid(),
  displayName: z.string().min(1).max(200),
  jobTitle: z.string().max(100).nullable().optional(),
  biography: z.string().max(2000).nullable().optional(),
  avatarMediaId: z.uuid().nullable().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contractor']).optional(),
  hireDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format')
    .refine((val) => {
      const [year, month, day] = val.split('-').map(Number);
      if (!year || !month || !day) return false;
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    }, 'Must be a valid calendar date')
    .nullable()
    .optional(),

  excludeFromAutoAssignment: z.boolean().optional(),
  languages: z.array(z.string()).nullable().optional(),
  socialLinks: z.record(z.string(), z.string()).nullable().optional(),
});

export type CreateStaffMemberDto = z.infer<typeof createStaffMemberSchema>;
