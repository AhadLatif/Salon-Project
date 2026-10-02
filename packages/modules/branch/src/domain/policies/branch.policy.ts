import { ValidationError } from '@salon/shared';
import type { BranchValidationInput } from '../entities/branch.entity.js';

/**
 * Domain invariants for a branch and its opening hours.
 *
 * WHY A POLICY RATHER THAN A CONSTRUCTOR: these rules used to live in `BranchEntity.validate()` /
 * `validateOpeningHours()`, which meant applying them required an entity instance. Because an entity
 * is only supposed to exist once a row exists, `BranchRepository.create` had to fabricate one — with
 * a placeholder UUID and synthetic hour ids — merely to ask "is this a valid branch?". A pure
 * function over `BranchValidationInput` answers that question directly, for a persisted row and for a
 * prospective create payload alike.
 *
 * ⚠️ THE RULES BELOW ARE MOVED VERBATIM from the former entity. Error type (`ValidationError`),
 * messages and field maps are unchanged on purpose: the API surfaces them, and the write-path test
 * `create-branch.use-case.test.ts` asserts `ValidationError` for invalid opening hours.
 *
 * NOTE: several of these rules are STRICTER than the database. The `branches` table enforces only
 * `chk_branches_name` (non-empty name) — there is no constraint for country/currency format, hours
 * presence, time ordering or shift overlap. They are domain rules, not schema rules; do not weaken
 * them to match the DB, and be aware that direct SQL writes can create rows this policy rejects.
 */
export function assertValidBranch(branch: BranchValidationInput): void {
  if (!branch.businessId) {
    throw new ValidationError('Branch must belong to a business tenant (businessId is required).', {
      businessId: 'Required',
    });
  }
  if (!branch.name || branch.name.trim().length === 0) {
    throw new ValidationError('Branch name cannot be empty.', { name: 'Cannot be empty' });
  }
  if (!/^[A-Z]{2}$/i.test(branch.countryCode)) {
    throw new ValidationError('Country code must be exactly 2 characters (ISO 3166-1 alpha-2).', {
      countryCode: 'Invalid format',
    });
  }
  if (!/^[A-Z]{3}$/i.test(branch.currency)) {
    throw new ValidationError('Currency code must be exactly 3 characters (ISO 4217).', {
      currency: 'Invalid format',
    });
  }
  if (branch.openingHours.length === 0) {
    throw new ValidationError('Branch must have at least one opening hours entry.', {
      openingHours: 'Cannot be empty',
    });
  }

  assertValidOpeningHours(branch.openingHours);
}

/**
 * Validates the business logic of opening hours: valid weekdays, closed/open consistency, time
 * format, chronological ordering, and no overlapping shifts within the same day.
 */
export function assertValidOpeningHours(openingHours: BranchValidationInput['openingHours']): void {
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

  const toSeconds = (value: string): number => {
    const parts = value.split(':').map(Number);
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    const seconds = parts[2] ?? 0;
    return hours * 3600 + minutes * 60 + seconds;
  };

  const shiftsByDay: Record<number, { open: number; close: number }[]> = {};

  for (const hours of openingHours) {
    if (hours.dayOfWeek < 1 || hours.dayOfWeek > 7) {
      throw new ValidationError(
        `Invalid dayOfWeek: ${hours.dayOfWeek}. Must be between 1 (Monday) and 7 (Sunday).`,
        { dayOfWeek: 'Invalid day' },
      );
    }

    if (hours.isClosed) {
      // If it's closed, there should be no opening/closing times
      if (hours.opensAt !== null || hours.closesAt !== null) {
        throw new ValidationError(
          `Day ${hours.dayOfWeek} is marked closed but has opening/closing times.`,
          { opensAt: 'Must be null when closed' },
        );
      }
    } else {
      // If it's open, opening/closing times are mandatory
      if (hours.opensAt === null || hours.closesAt === null) {
        throw new ValidationError(
          `Day ${hours.dayOfWeek} is marked open but missing opening or closing times.`,
          { opensAt: 'Required when open' },
        );
      }
      // Validate time format before converting
      if (!timePattern.test(hours.opensAt) || !timePattern.test(hours.closesAt)) {
        throw new ValidationError(
          `Day ${hours.dayOfWeek} has invalid time format. Expected HH:MM or HH:MM:SS.`,
          { opensAt: 'Invalid time format' },
        );
      }
      if (toSeconds(hours.opensAt) >= toSeconds(hours.closesAt)) {
        throw new ValidationError(
          `Day ${hours.dayOfWeek} opening time (${hours.opensAt}) must be before closing time (${hours.closesAt}).`,
          { opensAt: 'Must be before closesAt' },
        );
      }

      if (!shiftsByDay[hours.dayOfWeek]) {
        shiftsByDay[hours.dayOfWeek] = [];
      }
      const dayArray = shiftsByDay[hours.dayOfWeek] ?? [];
      shiftsByDay[hours.dayOfWeek] = dayArray;
      dayArray.push({
        open: toSeconds(hours.opensAt),
        close: toSeconds(hours.closesAt),
      });
    }
  }

  // Validate overlaps
  for (const [dayStr, dayShifts] of Object.entries(shiftsByDay)) {
    dayShifts.sort((a, b) => a.open - b.open);
    for (let i = 0; i < dayShifts.length - 1; i++) {
      const currentShift = dayShifts[i];
      const nextShift = dayShifts[i + 1];
      if (currentShift && nextShift && currentShift.close > nextShift.open) {
        throw new ValidationError(`Day ${dayStr} has overlapping shifts.`, {
          openingHours: 'Overlapping shifts on the same day are not allowed',
        });
      }
    }
  }
}
