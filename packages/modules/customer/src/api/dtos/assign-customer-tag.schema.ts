import { z } from '@salon/validation';

export const assignCustomerTagSchema = z.object({
  tagId: z.uuid('Invalid tag ID format'),
});

export type AssignCustomerTagDto = z.infer<typeof assignCustomerTagSchema>;
