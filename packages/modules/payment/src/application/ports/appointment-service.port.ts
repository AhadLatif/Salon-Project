/**
 * Narrow consumer port for the Payment module over appointment-owned data.
 *
 * Strict module isolation: the payment repository may ONLY touch payment tables.
 * Any data about an appointment (services, prices, customer, completion) comes
 * through this port, which the composition root satisfies with the Appointment
 * module's `AppointmentPaymentService`. Amounts are exposed as raw unitPrice
 * strings so the Payment module controls all money math.
 */

export interface PaymentAppointmentSnapshotSegment {
  serviceId: string;
  unitPrice: string;
}

export interface PaymentAppointmentSnapshot {
  appointmentId: string;
  businessId: string;
  businessCustomerId: string;
  branchId: string;
  status:
    | 'pending'
    | 'confirmed'
    | 'checked_in'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show';
  segments: PaymentAppointmentSnapshotSegment[];
}

export interface PaymentAppointmentCompletionOptions {
  branchId?: string | undefined;
  actorUserId?: string | null | undefined;
  actorBusinessMemberId?: string | null | undefined;
}

export interface IPaymentAppointmentService {
  /** Tenant-scoped snapshot of appointment + service unit prices, or null if not found. */
  getPaymentSnapshot(
    businessId: string,
    appointmentId: string,
  ): Promise<PaymentAppointmentSnapshot | null>;

  /** Marks the appointment completed because it is paid in full (Fresha POS checkout). */
  completeAsPaid(
    businessId: string,
    appointmentId: string,
    options?: PaymentAppointmentCompletionOptions,
  ): Promise<void>;
}
