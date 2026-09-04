/**
 * Appointment module persistence port and data shapes.
 *
 * Architecture & Invariants:
 *  - Architectural Invariant: SQL ONLY in infrastructure/repositories and
 *    strictly against tables owned by the Appointment module schema.
 *  - Cross-Module Isolation: Service and staff snapshots (names, unit prices,
 *    durations, buffers, overrides) are resolved out-of-transaction by the application
 *    use-case via domain query ports (`IServiceValidator`, `IStaffValidator`).
 *  - Fast Atomic Write Transaction: `IAppointmentRepository.reserve()` receives
 *    pre-resolved booking snapshots (`ResolvedAppointmentBookingData`), performs pure
 *    in-memory timing derivation, and writes parent appointment, segments, GiST allocations,
 *    and audit status history in a single, sub-2ms atomic transaction.
 *  - The DB EXCLUDE constraint `no_staff_time_overlap` (GiST) on `appointment_service_allocations`
 *    remains the authoritative, atomic arbiter for concurrent double-booking protection.
 */

import type { AppointmentEntity } from '../../domain/entities/appointment.entity.js';

/**
 * A single service segment in a booking request.
 *
 * The caller provides serviceId and staffMemberId; snapshot fields
 * (serviceName, unitPrice, duration, buffers) are resolved via domain query ports
 * before persistence.
 */
export interface CreateAppointmentSegment {
  serviceId: string;
  staffMemberId: string;
  /** Optional override for the standard service duration (minutes). Not used in Phase 1. */
  overrideDurationMinutes?: number | undefined;
  notes?: string | null | undefined;
}

/** High-level request to book an appointment. */
export interface CreateAppointmentData {
  businessId: string;
  branchId: string;
  businessCustomerId: string;
  /** When the first segment begins (customer-selected slot). */
  scheduledStartAt: Date;
  bookingChannel: 'marketplace' | 'business_dashboard' | 'walk_in';
  segments: CreateAppointmentSegment[];
  createdByBusinessMemberId?: string | null | undefined;
  createdByUserId?: string | null | undefined;
}

export interface AppointmentFilters {
  branchId?: string | undefined;
  staffMemberId?: string | undefined;
  businessCustomerId?: string | undefined;
  status?: AppointmentEntity['status'] | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface CancelAppointmentData {
  businessId: string;
  appointmentId: string;
  branchId?: string | undefined;
  cancellationReason?: string | null | undefined;
  cancelledByUserId?: string | null | undefined;
  cancelledByBusinessMemberId?: string | null | undefined;
}

export interface TransitionAppointmentStatusData {
  businessId: string;
  appointmentId: string;
  branchId?: string | undefined;
  toStatus: AppointmentEntity['status'];
  actorUserId?: string | null | undefined;
  actorBusinessMemberId?: string | null | undefined;
  reason?: string | null | undefined;
}

export interface RescheduleAppointmentData {
  businessId: string;
  appointmentId: string;
  branchId?: string | undefined;
  newScheduledStartAt: Date;
  reason?: string | null | undefined;
  actorUserId?: string | null | undefined;
  actorBusinessMemberId?: string | null | undefined;
}

export interface GetAvailabilityData {
  businessId: string;
  branchId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  staffMemberId?: string | undefined;
}

export interface ResolvedAppointmentSegment {
  serviceId: string;
  serviceName: string;
  staffMemberId: string;
  staffDisplayName: string;
  unitPrice: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  startsAt: Date;
  endsAt: Date;
  occupiedStart: Date;
  occupiedEnd: Date;
  sequence: number;
  notes?: string | null | undefined;
}

export interface ResolvedAppointmentBookingData {
  businessId: string;
  branchId: string;
  businessCustomerId: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  bookingChannel: 'marketplace' | 'business_dashboard' | 'walk_in';
  initialStatus: 'confirmed' | 'pending';
  segments: ResolvedAppointmentSegment[];
  createdByBusinessMemberId?: string | null | undefined;
  createdByUserId?: string | null | undefined;
}

export interface OccupiedAllocationInterval {
  staffMemberId: string;
  occupiedStart: Date;
  occupiedEnd: Date;
}

export interface IAppointmentRepository {
  /** Atomically inserts appointment, service segments, GiST allocations, and status history. */
  reserve(data: ResolvedAppointmentBookingData): Promise<AppointmentEntity>;

  /** Retrieves an appointment by ID with all its service segments within a tenant boundary. */
  findById(
    businessId: string,
    appointmentId: string,
    branchId?: string,
  ): Promise<AppointmentEntity | null>;

  /** Queries appointments matching tenant-scoped filters with pagination. */
  findAll(
    businessId: string,
    filters: AppointmentFilters,
  ): Promise<{ appointments: AppointmentEntity[]; total: number }>;

  /** Atomically cancels an appointment, logs status history, and frees occupied allocations. */
  cancel(data: CancelAppointmentData): Promise<AppointmentEntity>;

  /** Atomically transitions appointment status, logs history, and frees allocations if terminal. */
  transitionStatus(data: TransitionAppointmentStatusData): Promise<AppointmentEntity>;

  /** Atomically reschedules an appointment to a new start time, checking for conflicts. */
  reschedule(data: RescheduleAppointmentData): Promise<AppointmentEntity>;

  /** Queries occupied allocation intervals for staff members in a time range. */
  findOccupiedAllocations(
    businessId: string,
    staffMemberIds: string[],
    start: Date,
    end: Date,
  ): Promise<OccupiedAllocationInterval[]>;

  /** Deletes all allocations for an appointment (used by lifecycle actions). */
  deleteAllocations(businessId: string, appointmentId: string): Promise<void>;
}
