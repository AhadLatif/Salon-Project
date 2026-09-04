import { describe, expect, it } from 'vitest';
import { computeTimedSegments } from '../src/domain/services/segment-timing.js';

describe('computeTimedSegments', () => {
  const startAt = new Date('2030-06-10T10:00:00.000Z');

  it('calculates occupied period with full buffers for a single segment', () => {
    const results = computeTimedSegments(startAt, [
      {
        durationMinutes: 30,
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 15,
        staffMemberId: 'staff-1',
      },
    ]);

    expect(results).toHaveLength(1);
    const seg = results[0];
    expect(seg?.startsAt).toEqual(new Date('2030-06-10T10:00:00.000Z'));
    expect(seg?.endsAt).toEqual(new Date('2030-06-10T10:30:00.000Z'));
    // bufferBefore = 10 min, bufferAfter = 15 min
    expect(seg?.occupiedStart).toEqual(new Date('2030-06-10T09:50:00.000Z'));
    expect(seg?.occupiedEnd).toEqual(new Date('2030-06-10T10:45:00.000Z'));
  });

  it('collapses intermediate buffers to 0 for consecutive segments with the same staff member', () => {
    const results = computeTimedSegments(startAt, [
      {
        durationMinutes: 30,
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 15,
        staffMemberId: 'staff-1',
      },
      {
        durationMinutes: 45,
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 20,
        staffMemberId: 'staff-1',
      },
    ]);

    expect(results).toHaveLength(2);
    // Segment 1: bufferBefore preserved (10m), bufferAfter collapsed (0)
    expect(results[0]?.occupiedStart).toEqual(new Date('2030-06-10T09:50:00.000Z'));
    expect(results[0]?.occupiedEnd).toEqual(new Date('2030-06-10T10:30:00.000Z'));

    // Segment 2: bufferBefore collapsed (0), bufferAfter preserved (20m)
    expect(results[1]?.occupiedStart).toEqual(new Date('2030-06-10T10:30:00.000Z'));
    expect(results[1]?.occupiedEnd).toEqual(new Date('2030-06-10T11:35:00.000Z'));
  });

  it('locates same-staff neighbors across other staff and splits the available gap without overlapping', () => {
    // Seg 0: Staff A (10:00 - 10:30, 30m)
    // Seg 1: Staff B (10:30 - 10:45, 15m)
    // Seg 2: Staff A (10:45 - 11:15, 30m)
    // Gap between Seg 0 end (10:30) and Seg 2 start (10:45) is 15 minutes.
    // Desired: Seg 0 bufferAfter = 25m, Seg 2 bufferBefore = 20m. Sum = 45m > 15m gap.
    // Split: appliedAfter = min(25, floor(15/2)) = 7m. appliedBefore = min(20, 15 - 7) = 8m.
    const results = computeTimedSegments(startAt, [
      {
        durationMinutes: 30,
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 25,
        staffMemberId: 'staff-A',
      },
      {
        durationMinutes: 15,
        bufferBeforeMinutes: 5,
        bufferAfterMinutes: 5,
        staffMemberId: 'staff-B',
      },
      {
        durationMinutes: 30,
        bufferBeforeMinutes: 20,
        bufferAfterMinutes: 10,
        staffMemberId: 'staff-A',
      },
    ]);

    expect(results).toHaveLength(3);

    // Seg 0 (Staff A): boundary start has full 10m bufferBefore (09:50).
    // bufferAfter is clamped to 7m (ends at 10:37).
    expect(results[0]?.occupiedStart).toEqual(new Date('2030-06-10T09:50:00.000Z'));
    expect(results[0]?.occupiedEnd).toEqual(new Date('2030-06-10T10:37:00.000Z'));

    // Seg 1 (Staff B): boundary on both sides for Staff B -> full configured buffers (5m each)
    expect(results[1]?.occupiedStart).toEqual(new Date('2030-06-10T10:25:00.000Z'));
    expect(results[1]?.occupiedEnd).toEqual(new Date('2030-06-10T10:50:00.000Z'));

    // Seg 2 (Staff A): bufferBefore is clamped to 8m (starts at 10:37).
    // boundary end has full 10m bufferAfter (ends at 11:25).
    // Notice: Seg 0 ends at 10:37 and Seg 2 starts at 10:37 -> exactly adjacent, ZERO overlap!
    expect(results[2]?.occupiedStart).toEqual(new Date('2030-06-10T10:37:00.000Z'));
    expect(results[2]?.occupiedEnd).toEqual(new Date('2030-06-10T11:25:00.000Z'));
  });
});
