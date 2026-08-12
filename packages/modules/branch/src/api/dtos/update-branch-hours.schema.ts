import { z } from '@salon/validation';
import { openingHourSchema } from './create-branch.schema.js';

const toSeconds = (value: string): number => {
  const parts = value.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const seconds = parts[2] ?? 0;
  return hours * 3600 + minutes * 60 + seconds;
};

export const updateBranchHoursSchema = z.object({
  openingHours: z
    .array(openingHourSchema)
    .min(1)
    .max(21)
    .refine(
      (hours) => {
        const shiftsByDay = hours.reduce(
          (acc, curr) => {
            if (!acc[curr.dayOfWeek]) acc[curr.dayOfWeek] = [];
            if (!curr.isClosed && curr.opensAt && curr.closesAt) {
              const dayArray = acc[curr.dayOfWeek] ?? [];
              acc[curr.dayOfWeek] = dayArray;
              dayArray.push({
                open: toSeconds(curr.opensAt),
                close: toSeconds(curr.closesAt),
              });
            }
            return acc;
          },
          {} as Record<number, { open: number; close: number }[]>,
        );

        for (const dayShifts of Object.values(shiftsByDay)) {
          dayShifts.sort((a, b) => a.open - b.open);
          for (let i = 0; i < dayShifts.length - 1; i++) {
            const currentShift = dayShifts[i];
            const nextShift = dayShifts[i + 1];
            if (currentShift && nextShift && currentShift.close > nextShift.open) {
              return false; // overlapping
            }
          }
        }
        return true;
      },
      { message: 'Overlapping shifts on the same day are not allowed' },
    )
    .openapi({
      description: 'Array of opening hours for the branch. This fully replaces the existing hours.',
    }),
});
