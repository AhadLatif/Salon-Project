import { z } from '@salon/validation';

export const createCustomerNoteSchema = z.object({
  note: z.string().trim().min(1, 'Note content cannot be empty').max(2000),
});

export type CreateCustomerNoteDto = z.infer<typeof createCustomerNoteSchema>;
