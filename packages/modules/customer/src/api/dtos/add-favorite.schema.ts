import { z } from '@salon/validation';

export const addFavoriteSchema = z
  .object({
    businessId: z.uuid('Invalid business ID').nullable().optional(),
    staffMemberId: z.uuid('Invalid staff member ID').nullable().optional(),
  })
  .refine(
    (data) =>
      (Boolean(data.businessId) && !data.staffMemberId) ||
      (Boolean(data.staffMemberId) && !data.businessId),
    {
      message: 'Must specify exactly one target: businessId or staffMemberId',
      path: ['businessId'],
    },
  );

export type AddFavoriteDto = z.infer<typeof addFavoriteSchema>;
