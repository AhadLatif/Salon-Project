import type { AppointmentEntity } from '../../domain/entities/appointment.entity.js';
import type {
  AppointmentFilters,
  IAppointmentRepository,
} from '../ports/appointment-repository.port.js';

export class ListAppointmentsUseCase {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  async execute(
    businessId: string,
    filters: AppointmentFilters,
  ): Promise<{ appointments: AppointmentEntity[]; total: number }> {
    return await this.appointmentRepository.findAll(businessId, filters);
  }
}
