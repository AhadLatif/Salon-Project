export const RECURRENCE_PERIODS: Record<string, number> = {
  weekly: 1,
  biweekly: 2,
  triweekly: 3,
  four_weekly: 4,
};

/**
 * Calculates the number of whole ISO calendar weeks (Monday-based) between two dates.
 * Returns negative if toDate is before fromDate.
 */
export function getWeeksBetween(fromDate: string | Date, toDate: string | Date): number {
  const from = typeof fromDate === 'string' ? new Date(`${fromDate}T00:00:00.000Z`) : fromDate;
  const to = typeof toDate === 'string' ? new Date(`${toDate}T00:00:00.000Z`) : toDate;

  // Align to Monday of each respective week
  const getMondayUtc = (d: Date) => {
    const day = d.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday));
  };

  const fromMonday = getMondayUtc(from);
  const toMonday = getMondayUtc(to);

  const diffMs = toMonday.getTime() - fromMonday.getTime();
  const msInWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor(diffMs / msInWeek);
}

/**
 * Checks if a recurring schedule starting at effectiveFrom is active on targetDate.
 *
 * Honors recurrence patterns:
 * - weekly: every week (period 1)
 * - biweekly: every 2nd week (period 2)
 * - triweekly: every 3rd week (period 3)
 * - four_weekly: every 4th week (period 4)
 */
export function isScheduleActiveOnDate(
  effectiveFrom: string | Date,
  recurrencePattern: 'weekly' | 'biweekly' | 'triweekly' | 'four_weekly' | string,
  targetDate: string | Date,
): boolean {
  const weeks = getWeeksBetween(effectiveFrom, targetDate);
  if (weeks < 0) {
    return false;
  }

  const period = RECURRENCE_PERIODS[recurrencePattern] ?? 1;
  return weeks % period === 0;
}
