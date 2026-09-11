/**
 * Cross-module payment service contract, PROVIDED by the appointment module.
 *
 * The Appointment module OWNS appointments and appointment_services. Per the
 * strict module-isolation invariant, the Payment module may NOT SQL against
 * those tables. Instead Payment declares a narrow consumer port (its own
 * `IPaymentAppointmentService`) and the composition root injects this service,
 * which is a thin structural read/write adapter over appointment-owned tables.
 *
 * Money math intentionally stays out of this service: the snapshot exposes raw
 * `unitPrice` strings so the Payment module can total them with its own integer
 * minor-unit arithmetic (no float drift, no cross-module debt).
 */
import type { AppointmentStatus } from '../../domain/entities/appointment.entity.js';

export interface AppointmentPaymentSnapshotSegment {
  serviceId: string;
  unitPrice: string;
}

export interface AppointmentPaymentSnapshot {
  appointmentId: string;
  businessId: string;
  businessCustomerId: string;
  branchId: string;
  status: AppointmentStatus;
  segments: AppointmentPaymentSnapshotSegment[];
}

export interface CompleteAsPaidOptions {
  branchId?: string | undefined;
  actorUserId?: string | null | undefined;
  actorBusinessMemberId?: string | null | undefined;
}

/** Read-only snapshot + paid-in-full completion, both scoped to a business tenant. */
export interface IAppointmentPaymentService {
  getPaymentSnapshot(
    businessId: string,
    appointmentId: string,
  ): Promise<AppointmentPaymentSnapshot | null>;
  completeAsPaid(
    businessId: string,
    appointmentId: string,
    options?: CompleteAsPaidOptions,
  ): Promise<void>;
}
