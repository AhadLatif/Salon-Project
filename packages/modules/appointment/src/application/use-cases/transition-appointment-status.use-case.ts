import type { AppointmentEntity } from '../../domain/entities/appointment.entity.js';
import type {
  IAppointmentRepository,
  TransitionAppointmentStatusData,
} from '../ports/appointment-repository.port.js';

export class TransitionAppointmentStatusUseCase {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  async execute(data: TransitionAppointmentStatusData): Promise<AppointmentEntity> {
    return await this.appointmentRepository.transitionStatus(data);
  }
}
