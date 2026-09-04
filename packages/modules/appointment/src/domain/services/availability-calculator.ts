/**
 * Pure domain service for calculating appointment availability.
 *
 * Implements the availability interval math (§7.1):
 * - Intersects working intervals with buffer requirements.
 * - Submits candidate slots against busy intervals (allocations + time off).
 * - Enforces half-open [start, end) interval non-overlap rules.
 */

export interface TimeInterval {
  start: Date;
  end: Date;
}

export interface AvailableSlot {
  startsAt: Date;
  endsAt: Date;
  staffMemberId: string;
}

export interface ComputeSlotsInput {
  staffMemberId: string;
  workingIntervals: TimeInterval[];
  busyIntervals: TimeInterval[];
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  stepMinutes?: number;
}

/**
 * Checks whether two half-open intervals [a.start, a.end) and [b.start, b.end) overlap.
 */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/**
 * Computes discrete available booking slots within working shifts that do not
 * conflict with any busy periods or buffer requirements.
 */
export function computeAvailableSlots(input: ComputeSlotsInput): AvailableSlot[] {
  const {
    staffMemberId,
    workingIntervals,
    busyIntervals,
    durationMinutes,
    bufferBeforeMinutes,
    bufferAfterMinutes,
    stepMinutes = 15,
  } = input;

  const slots: AvailableSlot[] = [];
  const durationMs = durationMinutes * 60_000;
  const bufferBeforeMs = bufferBeforeMinutes * 60_000;
  const bufferAfterMs = bufferAfterMinutes * 60_000;

  // Invariant: stepMinutes must be a finite positive integer.
  // A zero or negative step would produce an infinite loop; a fractional step
  // can cause floating-point cursor drift so we round to the nearest integer.
  const step = Math.round(stepMinutes);
  if (!Number.isFinite(step) || step < 1) {
    throw new Error(`Invalid stepMinutes: must be a positive integer, got ${stepMinutes}`);
  }
  const stepMs = step * 60_000;

  for (const shift of workingIntervals) {
    let cursor = shift.start.getTime() + bufferBeforeMs;
    const shiftEnd = shift.end.getTime();

    while (cursor + durationMs + bufferAfterMs <= shiftEnd) {
      const serviceStart = new Date(cursor);
      const serviceEnd = new Date(cursor + durationMs);

      const occupiedPeriod: TimeInterval = {
        start: new Date(cursor - bufferBeforeMs),
        end: new Date(cursor + durationMs + bufferAfterMs),
      };

      // Ensure occupied period does not overlap with any busy interval
      const hasConflict = busyIntervals.some((busy) => intervalsOverlap(occupiedPeriod, busy));

      if (!hasConflict) {
        slots.push({
          startsAt: serviceStart,
          endsAt: serviceEnd,
          staffMemberId,
        });
      }

      cursor += stepMs;
    }
  }

  return slots;
}

/**
 * Helper to extract the local timezone offset in minutes at a specific UTC instant.
 */
function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  });
  const tzPart = formatter.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value;
  if (tzPart?.startsWith('GMT')) {
    const match = tzPart.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (match?.[1] && match[2] && match[3]) {
      const sign = match[1] === '+' ? 1 : -1;
      const hours = parseInt(match[2], 10);
      const mins = parseInt(match[3], 10);
      return sign * (hours * 60 + mins);
    }
  }
  return 0;
}

/**
 * Converts a date string (YYYY-MM-DD) and local wall-clock time string (HH:mm[:ss])
 * in a given IANA timezone to an exact UTC Date object.
 *
 * Employs a self-correcting conversion to guarantee precision on Daylight Saving Time
 * transition dates when UTC offset changes across the day.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone = 'UTC'): Date {
  const parts = timeStr.split(':');
  const h = parts[0]?.padStart(2, '0') ?? '00';
  const m = parts[1]?.padStart(2, '0') ?? '00';
  const s = parts[2]?.padStart(2, '0') ?? '00';
  const normalizedTime = `${h}:${m}:${s}`;

  if (!timeZone || timeZone.toUpperCase() === 'UTC') {
    return new Date(`${dateStr}T${normalizedTime}.000Z`);
  }

  const localUtcMs = Date.parse(`${dateStr}T${normalizedTime}.000Z`);
  let offsetMinutes = getTimezoneOffsetMinutes(new Date(localUtcMs), timeZone);
  let candidateUtc = new Date(localUtcMs - offsetMinutes * 60_000);

  // Self-correcting step: re-sample offset at candidate UTC instant in case local time crossed a DST transition
  const refinedOffsetMinutes = getTimezoneOffsetMinutes(candidateUtc, timeZone);
  if (refinedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = refinedOffsetMinutes;
    candidateUtc = new Date(localUtcMs - offsetMinutes * 60_000);
  }

  return candidateUtc;
}

/**
 * Formats a Date to a local wall-clock time string (HH:mm:ss) in the given IANA timezone.
 */
export function utcToZonedTimeString(date: Date, timeZone = 'UTC'): string {
  if (!timeZone || timeZone.toUpperCase() === 'UTC') {
    return date.toISOString().slice(11, 19);
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const hour = (parts.find((p) => p.type === 'hour')?.value ?? '00').padStart(2, '0');
  const minute = (parts.find((p) => p.type === 'minute')?.value ?? '00').padStart(2, '0');
  const second = (parts.find((p) => p.type === 'second')?.value ?? '00').padStart(2, '0');
  return `${hour}:${minute}:${second}`;
}

/**
 * Formats a Date to a local date string (YYYY-MM-DD) in the given IANA timezone.
 */
export function utcToZonedDateString(date: Date, timeZone = 'UTC'): string {
  if (!timeZone || timeZone.toUpperCase() === 'UTC') {
    return date.toISOString().split('T')[0] ?? '';
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = (parts.find((p) => p.type === 'month')?.value ?? '01').padStart(2, '0');
  const day = (parts.find((p) => p.type === 'day')?.value ?? '01').padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns ISO day of week (1 = Monday ... 7 = Sunday) for a Date in the given IANA timezone.
 */
export function utcToZonedDayOfWeek(date: Date, timeZone = 'UTC'): number {
  if (!timeZone || timeZone.toUpperCase() === 'UTC') {
    const jsDay = date.getUTCDay();
    return jsDay === 0 ? 7 : jsDay;
  }
  const dateStr = utcToZonedDateString(date, timeZone);
  const [y, m, d] = dateStr.split('-').map(Number);
  const localDate = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  const jsDay = localDate.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}
