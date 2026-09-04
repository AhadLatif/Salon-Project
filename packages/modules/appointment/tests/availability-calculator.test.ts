import { describe, expect, it } from 'vitest';
import {
  computeAvailableSlots,
  intervalsOverlap,
  zonedTimeToUtc,
} from '../src/domain/services/availability-calculator.js';

describe('Availability Calculator Domain Service', () => {
  describe('intervalsOverlap', () => {
    it('returns true for overlapping half-open intervals', () => {
      const a = { start: new Date('2030-01-01T10:00:00Z'), end: new Date('2030-01-01T11:00:00Z') };
      const b = { start: new Date('2030-01-01T10:30:00Z'), end: new Date('2030-01-01T11:30:00Z') };
      expect(intervalsOverlap(a, b)).toBe(true);
    });

    it('returns false for adjacent half-open intervals (boundary touching)', () => {
      const a = { start: new Date('2030-01-01T10:00:00Z'), end: new Date('2030-01-01T11:00:00Z') };
      const b = { start: new Date('2030-01-01T11:00:00Z'), end: new Date('2030-01-01T12:00:00Z') };
      expect(intervalsOverlap(a, b)).toBe(false);
    });

    it('returns false for disjoint intervals', () => {
      const a = { start: new Date('2030-01-01T10:00:00Z'), end: new Date('2030-01-01T11:00:00Z') };
      const b = { start: new Date('2030-01-01T14:00:00Z'), end: new Date('2030-01-01T15:00:00Z') };
      expect(intervalsOverlap(a, b)).toBe(false);
    });
  });

  describe('computeAvailableSlots', () => {
    const shift = {
      start: new Date('2030-01-01T09:00:00Z'),
      end: new Date('2030-01-01T12:00:00Z'),
    };

    it('generates slots at step intervals when there are no busy periods', () => {
      const slots = computeAvailableSlots({
        staffMemberId: 'staff-1',
        workingIntervals: [shift],
        busyIntervals: [],
        durationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        stepMinutes: 60,
      });

      expect(slots).toHaveLength(3);
      expect(slots[0]?.startsAt.toISOString()).toBe('2030-01-01T09:00:00.000Z');
      expect(slots[1]?.startsAt.toISOString()).toBe('2030-01-01T10:00:00.000Z');
      expect(slots[2]?.startsAt.toISOString()).toBe('2030-01-01T11:00:00.000Z');
    });

    it('skips slots that overlap with busy intervals', () => {
      const busy = [
        { start: new Date('2030-01-01T10:00:00Z'), end: new Date('2030-01-01T11:00:00Z') },
      ];

      const slots = computeAvailableSlots({
        staffMemberId: 'staff-1',
        workingIntervals: [shift],
        busyIntervals: busy,
        durationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        stepMinutes: 60,
      });

      expect(slots).toHaveLength(2);
      expect(slots[0]?.startsAt.toISOString()).toBe('2030-01-01T09:00:00.000Z');
      expect(slots[1]?.startsAt.toISOString()).toBe('2030-01-01T11:00:00.000Z');
    });

    it('accounts for buffers when evaluating conflicts', () => {
      // Busy from 10:30 to 11:30
      const busy = [
        { start: new Date('2030-01-01T10:30:00Z'), end: new Date('2030-01-01T11:30:00Z') },
      ];

      // A 60-min service at 09:30 with 15-min after buffer would occupy until 10:45 -> conflicts with busy!
      const slots = computeAvailableSlots({
        staffMemberId: 'staff-1',
        workingIntervals: [shift],
        busyIntervals: busy,
        durationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 15,
        stepMinutes: 30,
      });

      // 09:00 - 10:00 (+15 buffer = 10:15) does NOT conflict with 10:30
      // 09:30 - 10:30 (+15 buffer = 10:45) conflicts with 10:30
      const startTimes = slots.map((s) => s.startsAt.toISOString());
      expect(startTimes).toContain('2030-01-01T09:00:00.000Z');
      expect(startTimes).not.toContain('2030-01-01T09:30:00.000Z');
    });
  });

  describe('zonedTimeToUtc', () => {
    it('returns exact UTC timestamp when timeZone is UTC', () => {
      const utcDate = zonedTimeToUtc('2030-06-15', '09:00:00', 'UTC');
      expect(utcDate.toISOString()).toBe('2030-06-15T09:00:00.000Z');
    });

    it('correctly converts negative offset timezone (America/New_York EDT, UTC-4 in June)', () => {
      const nyDate = zonedTimeToUtc('2030-06-15', '09:00:00', 'America/New_York');
      expect(nyDate.toISOString()).toBe('2030-06-15T13:00:00.000Z');
    });

    it('correctly converts positive offset timezone (Asia/Tokyo, UTC+9)', () => {
      const tokyoDate = zonedTimeToUtc('2030-06-15', '09:00:00', 'Asia/Tokyo');
      expect(tokyoDate.toISOString()).toBe('2030-06-15T00:00:00.000Z');
    });

    it('correctly converts times across Daylight Saving Time transition boundaries', () => {
      // In America/New_York on 2026-11-01 (Fall Back):
      // 01:00 AM EDT is UTC-4 -> 05:00:00.000Z
      const preTransition = zonedTimeToUtc('2026-11-01', '01:00:00', 'America/New_York');
      expect(preTransition.toISOString()).toBe('2026-11-01T05:00:00.000Z');

      // 03:00 AM EST (after fall-back) is UTC-5 -> 08:00:00.000Z
      const postTransition = zonedTimeToUtc('2026-11-01', '03:00:00', 'America/New_York');
      expect(postTransition.toISOString()).toBe('2026-11-01T08:00:00.000Z');
    });
  });
});
