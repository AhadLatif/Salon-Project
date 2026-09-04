import { describe, expect, it } from 'vitest';
import {
  getWeeksBetween,
  isScheduleActiveOnDate,
} from '../src/domain/services/schedule-recurrence.js';

describe('schedule-recurrence domain helper', () => {
  describe('getWeeksBetween', () => {
    it('returns 0 for dates within the same ISO calendar week', () => {
      // 2026-09-07 is Monday, 2026-09-13 is Sunday
      expect(getWeeksBetween('2026-09-07', '2026-09-07')).toBe(0);
      expect(getWeeksBetween('2026-09-07', '2026-09-09')).toBe(0);
      expect(getWeeksBetween('2026-09-07', '2026-09-13')).toBe(0);
    });

    it('returns 1 for the next calendar week', () => {
      // 2026-09-14 is the following Monday
      expect(getWeeksBetween('2026-09-07', '2026-09-14')).toBe(1);
      expect(getWeeksBetween('2026-09-07', '2026-09-16')).toBe(1);
    });

    it('returns negative when toDate is before fromDate', () => {
      expect(getWeeksBetween('2026-09-14', '2026-09-07')).toBe(-1);
    });
  });

  describe('isScheduleActiveOnDate', () => {
    const effectiveFrom = '2026-09-07'; // Week 0 (Monday)

    it('weekly pattern is active every week', () => {
      expect(isScheduleActiveOnDate(effectiveFrom, 'weekly', '2026-09-07')).toBe(true); // week 0
      expect(isScheduleActiveOnDate(effectiveFrom, 'weekly', '2026-09-14')).toBe(true); // week 1
      expect(isScheduleActiveOnDate(effectiveFrom, 'weekly', '2026-09-21')).toBe(true); // week 2
      expect(isScheduleActiveOnDate(effectiveFrom, 'weekly', '2026-09-28')).toBe(true); // week 3
    });

    it('biweekly pattern is active every 2nd week (period 2)', () => {
      expect(isScheduleActiveOnDate(effectiveFrom, 'biweekly', '2026-09-07')).toBe(true); // week 0
      expect(isScheduleActiveOnDate(effectiveFrom, 'biweekly', '2026-09-14')).toBe(false); // week 1
      expect(isScheduleActiveOnDate(effectiveFrom, 'biweekly', '2026-09-21')).toBe(true); // week 2
      expect(isScheduleActiveOnDate(effectiveFrom, 'biweekly', '2026-09-28')).toBe(false); // week 3
      expect(isScheduleActiveOnDate(effectiveFrom, 'biweekly', '2026-10-05')).toBe(true); // week 4
    });

    it('triweekly pattern is active every 3rd week (period 3)', () => {
      expect(isScheduleActiveOnDate(effectiveFrom, 'triweekly', '2026-09-07')).toBe(true); // week 0
      expect(isScheduleActiveOnDate(effectiveFrom, 'triweekly', '2026-09-14')).toBe(false); // week 1
      expect(isScheduleActiveOnDate(effectiveFrom, 'triweekly', '2026-09-21')).toBe(false); // week 2
      expect(isScheduleActiveOnDate(effectiveFrom, 'triweekly', '2026-09-28')).toBe(true); // week 3
      expect(isScheduleActiveOnDate(effectiveFrom, 'triweekly', '2026-10-05')).toBe(false); // week 4
    });

    it('four_weekly pattern is active every 4th week (period 4)', () => {
      expect(isScheduleActiveOnDate(effectiveFrom, 'four_weekly', '2026-09-07')).toBe(true); // week 0
      expect(isScheduleActiveOnDate(effectiveFrom, 'four_weekly', '2026-09-14')).toBe(false); // week 1
      expect(isScheduleActiveOnDate(effectiveFrom, 'four_weekly', '2026-09-21')).toBe(false); // week 2
      expect(isScheduleActiveOnDate(effectiveFrom, 'four_weekly', '2026-09-28')).toBe(false); // week 3
      expect(isScheduleActiveOnDate(effectiveFrom, 'four_weekly', '2026-10-05')).toBe(true); // week 4
    });

    it('returns false for dates before effectiveFrom', () => {
      expect(isScheduleActiveOnDate(effectiveFrom, 'weekly', '2026-08-31')).toBe(false);
    });
  });
});
