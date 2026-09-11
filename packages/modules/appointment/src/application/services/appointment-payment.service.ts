import type {
  AppointmentPaymentSnapshot,
  CompleteAsPaidOptions,
  IAppointmentPaymentService,
} from '../ports/appointment-payment-service.port.js';
import type { IAppointmentRepository } from '../ports/appointment-repository.port.js';

/**
 * Concrete cross-module payment adapter for the Appointment module.
 *
 * Reads appointment + service-segment snapshots scoped to the tenant and marks an
 * appointment completed after it is paid in full. Both flows delegate to the
 * appointment repository (the only SQL owner of appointment tables). The service
 * exposes pure data; all money math happens in the consuming Payment module.
 */
export class AppointmentPaymentService implements IAppointmentPaymentService {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  async getPaymentSnapshot(
    businessId: string,
    appointmentId: string,
  ): Promise<AppointmentPaymentSnapshot | null> {
    const appointment = await this.appointmentRepository.findById(businessId, appointmentId);
    if (!appointment) {
      return null;
    }
    return {
      appointmentId: appointment.id,
      businessId: appointment.businessId,
      businessCustomerId: appointment.businessCustomerId,
      branchId: appointment.branchId,
      status: appointment.status,
      segments: appointment.segments.map((seg) => ({
        serviceId: seg.serviceId,
        unitPrice: seg.unitPrice,
      })),
    };
  }

  async completeAsPaid(
    businessId: string,
    appointmentId: string,
    options?: CompleteAsPaidOptions,
  ): Promise<void> {
    await this.appointmentRepository.completeForPayment({
      businessId,
      appointmentId,
      branchId: options?.branchId ?? undefined,
      actorUserId: options?.actorUserId ?? null,
      actorBusinessMemberId: options?.actorBusinessMemberId ?? null,
    });
  }
}
