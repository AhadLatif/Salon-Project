import { z } from '@salon/validation';

const toSeconds = (value: string): number => {
  const parts = value.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const seconds = parts[2] ?? 0;
  return hours * 3600 + minutes * 60 + seconds;
};

export const openingHourSchema = z
  .object({
    dayOfWeek: z.number().int().min(1).max(7),
    shiftName: z.string().max(50).nullable().optional(),
    isClosed: z.boolean(),
    // Regex for HH:MM:SS or HH:MM
    opensAt: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/)
      .nullable(),
    closesAt: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/)
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.isClosed) {
      if (data.opensAt !== null || data.closesAt !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'opensAt and closesAt must be null when isClosed is true',
        });
      }
    } else {
      if (data.opensAt === null || data.closesAt === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'opensAt and closesAt are required when isClosed is false',
        });
      } else if (toSeconds(data.opensAt) >= toSeconds(data.closesAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'opensAt must be earlier than closesAt',
        });
      }
    }
  });

export const createBranchSchema = z.object({
  name: z.string().trim().min(1).max(255).openapi({ example: 'Downtown Branch' }),
  phoneNumber: z.string().max(50).nullable().optional().openapi({ example: '+1234567890' }),
  email: z.email().max(255).nullable().optional().openapi({ example: 'downtown@salon.com' }),
  timezone: z.string().max(100).openapi({ example: 'America/New_York' }),
  currency: z.string().length(3).openapi({ example: 'USD' }),
  addressLine1: z.string().min(1).max(255).openapi({ example: '123 Main St' }),
  addressLine2: z.string().max(255).nullable().optional(),
  city: z.string().min(1).max(100).openapi({ example: 'New York' }),
  state: z.string().max(100).nullable().optional().openapi({ example: 'NY' }),
  postalCode: z.string().max(20).nullable().optional().openapi({ example: '10001' }),
  countryCode: z.string().length(2).openapi({ example: 'US' }),
  latitude: z
    .string()
    .regex(/^-?\d{1,2}\.\d+$/)
    .refine(
      (val) => {
        const num = parseFloat(val);
        return num >= -90 && num <= 90;
      },
      { message: 'Latitude must be between -90 and 90' },
    )
    .nullable()
    .optional()
    .openapi({ example: '40.7128' }),
  longitude: z
    .string()
    .regex(/^-?\d{1,3}\.\d+$/)
    .refine(
      (val) => {
        const num = parseFloat(val);
        return num >= -180 && num <= 180;
      },
      { message: 'Longitude must be between -180 and 180' },
    )
    .nullable()
    .optional()
    .openapi({ example: '-74.0060' }),

  // Requires exactly 7 entries (one for each day) or allows partial?
  // Fresha generally allows saving just the open days, but we can enforce 1-7.
  openingHours: z.array(openingHourSchema).min(1).max(21).openapi({
    description: 'Array of opening hours for the branch. Can contain multiple shifts per day.',
  }),
});
