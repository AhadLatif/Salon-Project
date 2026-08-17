import { ForbiddenError, ValidationError } from '@salon/shared';
import type { IStaffRepository, StaffScheduleShift } from '../ports/staff-repository.port.js';

export interface AddShiftToScheduleData {
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
}

export class AddShiftToScheduleUseCase {
  constructor(private readonly staffRepository: IStaffRepository) {}

  async execute(
    businessId: string,
    workScheduleId: string,
    data: AddShiftToScheduleData,
  ): Promise<StaffScheduleShift> {
    // Tenant Boundary check
    const isValid = await this.staffRepository.isWorkScheduleInBusiness(businessId, workScheduleId);
    if (!isValid) {
      throw new ForbiddenError(
        'Invalid work schedule ID or schedule does not belong to this business',
      );
    }

    // dayOfWeek must be 1-7 (Monday-Sunday)
    if (!Number.isInteger(data.dayOfWeek) || data.dayOfWeek < 1 || data.dayOfWeek > 7) {
      throw new ValidationError(
        'dayOfWeek must be an integer between 1 and 7 (Monday=1, Sunday=7).',
      );
    }

    if (data.startsAt >= data.endsAt) {
      throw new ValidationError('Shift endsAt must be strictly later than startsAt', {
        timeWindow: 'startsAt must be earlier than endsAt',
      });
    }

    return await this.staffRepository.addShiftToSchedule(workScheduleId, data);
  }
}
