/**
 * Appointment domain model.
 *
 * The appointment module is the sole owner of booking lifecycle, scheduling
 * state, and the status transition machine. This file defines the entity
 * shapes that flow across the application/infrastructure boundary.
 *
 * Schema source-of-truth: packages/infrastructure/database/src/schema/appointment/
 * (appointments, appointment_services, appointment_service_allocations,
 *  appointment_status_history)
 *
 * Product decisions (docs/workflows/appointment/ROADMAP.md §3):
 *  - Statuses that block the calendar: pending, confirmed, checked_in, in_progress
 *    (completed, cancelled, no_show free the slot via allocation deletion).
 *  - Channel → initial status: business_dashboard / walk_in → confirmed;
 *    marketplace → pending.
 */

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type BookingChannel = 'marketplace' | 'business_dashboard' | 'walk_in';

/**
 * Statuses that actively occupy staff calendar time.
 * Allocations exist only while the appointment is in one of these statuses.
 * On transition to a terminal/non-blocking status, allocations are deleted
 * atomically with the status change (§3 decision #1, §5.3).
 */
export const BLOCKING_STATUSES: ReadonlySet<AppointmentStatus> = new Set<AppointmentStatus>([
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
]);

/** Maps a booking channel to the initial appointment status (§3 decision #3). */
export function initialStatusForChannel(channel: BookingChannel): AppointmentStatus {
  if (channel === 'marketplace') return 'pending';
  // business_dashboard and walk_in start as confirmed
  return 'confirmed';
}

/**
 * Strict Finite State Machine (FSM) for appointment status transitions.
 *
 * pending     --> confirmed, cancelled
 * confirmed   --> checked_in, cancelled, no_show
 * checked_in  --> in_progress, cancelled
 * in_progress --> completed
 *
 * Terminal statuses: completed, cancelled, no_show (cannot transition further).
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransitionStatus(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Immutable snapshot of a service segment taken at booking time (§4 invariant #3). */
export interface AppointmentSegmentEntity {
  id: string;
  appointmentId: string;
  serviceId: string;
  staffMemberId: string;
  serviceName: string;
  staffName: string;
  unitPrice: string;
  durationMinutes: number;
  processingTimeMinutes: number;
  extraTimeMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  startsAt: Date;
  endsAt: Date;
  sequence: number;
  notes: string | null;
}

/** The parent appointment aggregate root. */
export interface AppointmentEntity {
  id: string;
  businessId: string;
  branchId: string;
  businessCustomerId: string;
  status: AppointmentStatus;
  bookingChannel: BookingChannel;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  createdByUserId: string | null;
  createdByBusinessMemberId: string | null;
  cancellationReason?: string | null | undefined;
  cancelledAt?: Date | null | undefined;
  cancelledByUserId?: string | null | undefined;
  cancelledByBusinessMemberId?: string | null | undefined;
  segments: AppointmentSegmentEntity[];
  createdAt: Date;
  updatedAt: Date;
}
