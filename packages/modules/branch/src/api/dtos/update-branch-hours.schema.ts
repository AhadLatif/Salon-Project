import { z } from '@salon/validation';
import { openingHourSchema } from './create-branch.schema.js';

export const updateBranchHoursSchema = z.object({
  openingHours: z.array(openingHourSchema).min(1).max(21).openapi({
    description: 'Array of opening hours for the branch. This fully replaces the existing hours.',
  }),
});
