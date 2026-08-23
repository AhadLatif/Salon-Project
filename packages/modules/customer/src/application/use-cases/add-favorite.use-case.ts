import { ResourceNotFoundError, ValidationError } from '@salon/shared';
import type { CustomerFavoriteEntity } from '../../domain/entities/customer-favorite.entity.js';
import type { IBusinessValidator } from '../ports/business-validator.port.js';
import type {
  CreateCustomerFavoriteData,
  ICustomerFavoriteRepository,
} from '../ports/customer-repository.port.js';
import type { IStaffValidator } from '../ports/staff-validator.port.js';

export class AddFavoriteUseCase {
  constructor(
    private readonly customerFavoriteRepository: ICustomerFavoriteRepository,
    private readonly businessValidator: IBusinessValidator,
    private readonly staffValidator: IStaffValidator,
  ) {}

  /**
   * Adds a business or staff member to a B2C user's favorites list.
   *
   * Invariants:
   * 1. Exactly one target (businessId OR staffMemberId) must be provided.
   * 2. Target must exist in the platform.
   * 3. Operation is idempotent (returns existing if already favorited).
   */
  async execute(data: CreateCustomerFavoriteData): Promise<CustomerFavoriteEntity> {
    const hasBusiness = Boolean(data.businessId);
    const hasStaff = Boolean(data.staffMemberId);

    if ((hasBusiness && hasStaff) || (!hasBusiness && !hasStaff)) {
      throw new ValidationError('Must specify exactly one target: businessId or staffMemberId');
    }

    if (data.businessId) {
      const exists = await this.businessValidator.businessExists(data.businessId);
      if (!exists) {
        throw new ResourceNotFoundError('Target business not found');
      }
    }

    if (data.staffMemberId) {
      const exists = await this.staffValidator.isStaffMemberActive(data.staffMemberId);
      if (!exists) {
        throw new ResourceNotFoundError('Target staff member not found');
      }
    }

    // Check if already favorited (idempotent return)
    const existing = await this.customerFavoriteRepository.findByTarget(data.userId, {
      businessId: data.businessId,
      staffMemberId: data.staffMemberId,
    });

    if (existing) {
      return existing;
    }

    return this.customerFavoriteRepository.create(data);
  }
}
