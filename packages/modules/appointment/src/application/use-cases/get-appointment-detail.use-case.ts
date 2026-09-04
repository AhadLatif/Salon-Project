import { ResourceNotFoundError } from '@salon/shared';
import type { AppointmentEntity } from '../../domain/entities/appointment.entity.js';
import type { IAppointmentRepository } from '../ports/appointment-repository.port.js';

export class GetAppointmentDetailUseCase {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  async execute(
    businessId: string,
    appointmentId: string,
    branchId?: string,
  ): Promise<AppointmentEntity> {
    const appointment = await this.appointmentRepository.findById(
      businessId,
      appointmentId,
      branchId,
    );
    if (!appointment) {
      throw new ResourceNotFoundError(`Appointment ${appointmentId} not found in this business`);
    }
    return appointment;
  }
}
