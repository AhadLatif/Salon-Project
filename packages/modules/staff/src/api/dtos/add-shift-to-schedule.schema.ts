import { z } from '@salon/validation';

export const addShiftToScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Must be in HH:mm format'),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Must be in HH:mm format'),
});

export type AddShiftToScheduleDto = z.infer<typeof addShiftToScheduleSchema>;
