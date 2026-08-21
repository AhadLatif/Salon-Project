import { ForbiddenError, ResourceNotFoundError } from '@salon/shared';
import type { IServiceValidator } from '../ports/service-validator.port.js';
import type { IStaffRepository, StaffServiceAssignment } from '../ports/staff-repository.port.js';

export interface AssignServiceToStaffData {
  overridePrice?: string | null | undefined;
  overrideDurationMinutes?: number | null | undefined;
  isBookable?: boolean | undefined;
}

export class AssignServiceToStaffUseCase {
  constructor(
    private readonly staffRepository: IStaffRepository,
    private readonly serviceValidator: IServiceValidator,
  ) {}

  async execute(
    businessId: string,
    staffMemberId: string,
    serviceId: string,
    data: AssignServiceToStaffData = {},
  ): Promise<StaffServiceAssignment> {
    // 1. Staff member must exist in this business
    const staff = await this.staffRepository.findById(businessId, staffMemberId);
    if (!staff) {
      throw new ResourceNotFoundError('Staff member not found');
    }

    // 2. Cross-tenant service guard: serviceId must belong to this business and be active
    const serviceValid = await this.serviceValidator.isServiceInBusiness(businessId, serviceId);
    if (!serviceValid) {
      throw new ForbiddenError('Invalid service ID or service does not belong to this business');
    }

    return await this.staffRepository.assignService(businessId, staffMemberId, serviceId, data);
  }
}
