import type { AppointmentEntity } from '../../domain/entities/appointment.entity.js';
import type {
  CancelAppointmentData,
  IAppointmentRepository,
} from '../ports/appointment-repository.port.js';

export class CancelAppointmentUseCase {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  async execute(data: CancelAppointmentData): Promise<AppointmentEntity> {
    return await this.appointmentRepository.cancel(data);
  }
}
