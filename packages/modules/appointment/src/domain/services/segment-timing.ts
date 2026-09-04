/**
 * Pure domain helpers for appointment segment timing.
 *
 * These functions have no side-effects and no DB dependency — they calculate
 * the sequential start/end times and buffer-aware occupied periods that the
 * repository persists and that the GiST EXCLUDE constraint validates.
 *
 * Product decisions (docs/workflows/appointment/ROADMAP.md §3):
 *  #4  Multi-service bookings use sequential appointment_services rows.
 *  #7  processingTime / extraTime are snapshot-only and do NOT extend the
 *      bookable/occupied interval.
 *  #6  occupiedPeriod = [startsAt − bufferBefore, endsAt + bufferAfter)
 */

/** Start/end instants for a single service segment (no buffer applied). */
export interface SegmentTiming {
  startsAt: Date;
  endsAt: Date;
}

/**
 * Derives sequential start/end instants for N appointment segments.
 *
 * The first segment begins at `firstSegmentStart`; every subsequent segment
 * starts when the previous one ends. The resulting array is used to populate
 * `appointment_services.startsAt` / `endsAt` and to derive the parent
 * `appointments.scheduledStartAt` / `endedAt` (§4 — parent time derives from segments).
 *
 * @param firstSegmentStart  When the first segment is scheduled to begin.
 * @param durationsMinutes   Service duration per segment (minutes), in order.
 */
export function deriveSegmentTimes(
  firstSegmentStart: Date,
  durationsMinutes: readonly number[],
): SegmentTiming[] {
  const timings: SegmentTiming[] = [];
  let cursor = firstSegmentStart.getTime();

  for (const duration of durationsMinutes) {
    const startsAt = new Date(cursor);
    const endsAt = new Date(cursor + duration * 60_000);
    timings.push({ startsAt, endsAt });
    cursor = endsAt.getTime();
  }

  return timings;
}

/**
 * Computes the staff "occupied" interval for a segment, including buffers.
 *
 * Per §6, the staff member is occupied from
 *   [ startsAt − bufferBefore, endsAt + bufferAfter )
 * processingTimeMinutes / extraTimeMinutes are NOT added to this interval (§7).
 * The [) bound matches the EXCLUDE USING GIST constraint that uses && (overlaps).
 */
export function computeOccupiedPeriod(
  startsAt: Date,
  endsAt: Date,
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number,
): { start: Date; end: Date } {
  const start = new Date(startsAt.getTime() - bufferBeforeMinutes * 60_000);
  const end = new Date(endsAt.getTime() + bufferAfterMinutes * 60_000);
  return { start, end };
}

export interface SegmentTimingInput {
  staffMemberId: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
}

export interface TimedSegmentCalculation {
  startsAt: Date;
  endsAt: Date;
  occupiedStart: Date;
  occupiedEnd: Date;
  sequence: number;
}

/**
 * Derives sequential start/end times and buffer-aware occupied periods for appointment segments.
 * Consecutive segments assigned to the same staff member have intermediate buffers collapsed.
 */
export function computeTimedSegments(
  firstSegmentStart: Date,
  segments: readonly SegmentTimingInput[],
): TimedSegmentCalculation[] {
  const durations = segments.map((s) => s.durationMinutes);
  const timings = deriveSegmentTimes(firstSegmentStart, durations);

  const resolvedBufferBefore = segments.map((s) => s.bufferBeforeMinutes);
  const resolvedBufferAfter = segments.map((s) => s.bufferAfterMinutes);

  // Group segment indices by staff member to resolve intermediate gaps
  const staffSegmentIndices = new Map<string, number[]>();
  segments.forEach((seg, i) => {
    const list = staffSegmentIndices.get(seg.staffMemberId) ?? [];
    list.push(i);
    staffSegmentIndices.set(seg.staffMemberId, list);
  });

  // For each staff member with multiple segments, resolve consecutive pairs
  for (const indices of staffSegmentIndices.values()) {
    for (let k = 0; k < indices.length - 1; k++) {
      const prevIdx = indices[k];
      const nextIdx = indices[k + 1];
      if (prevIdx === undefined || nextIdx === undefined) continue;

      const prevTiming = timings[prevIdx];
      const nextTiming = timings[nextIdx];
      const prevSeg = segments[prevIdx];
      const nextSeg = segments[nextIdx];
      if (!prevTiming || !nextTiming || !prevSeg || !nextSeg) continue;

      const gap = Math.max(
        0,
        (nextTiming.startsAt.getTime() - prevTiming.endsAt.getTime()) / 60_000,
      );

      const desiredAfter = prevSeg.bufferAfterMinutes;
      const desiredBefore = nextSeg.bufferBeforeMinutes;

      if (gap === 0) {
        // Immediately adjacent: collapse intermediate turnaround buffers completely
        resolvedBufferAfter[prevIdx] = 0;
        resolvedBufferBefore[nextIdx] = 0;
      } else if (desiredAfter + desiredBefore > gap) {
        // Interleaved by other staff with limited gap: split gap fairly so occupied periods never overlap
        const appliedAfter = Math.min(desiredAfter, Math.floor(gap / 2));
        const appliedBefore = Math.min(desiredBefore, gap - appliedAfter);
        resolvedBufferAfter[prevIdx] = appliedAfter;
        resolvedBufferBefore[nextIdx] = appliedBefore;
      } else {
        // Sufficient gap: each segment gets its desired buffer
        resolvedBufferAfter[prevIdx] = desiredAfter;
        resolvedBufferBefore[nextIdx] = desiredBefore;
      }
    }
  }

  return segments.map((_seg, i) => {
    const timing = timings[i];
    if (!timing) {
      throw new Error('Internal invariant: missing segment timing calculation.');
    }

    const bufferBefore = resolvedBufferBefore[i] ?? 0;
    const bufferAfter = resolvedBufferAfter[i] ?? 0;

    const occupied = computeOccupiedPeriod(
      timing.startsAt,
      timing.endsAt,
      bufferBefore,
      bufferAfter,
    );

    return {
      startsAt: timing.startsAt,
      endsAt: timing.endsAt,
      occupiedStart: occupied.start,
      occupiedEnd: occupied.end,
      sequence: i + 1,
    };
  });
}
