import type { CustomerFavoriteEntity } from '../../domain/entities/customer-favorite.entity.js';
import type { ICustomerFavoriteRepository } from '../ports/customer-repository.port.js';

export class GetUserFavoritesUseCase {
  constructor(private readonly customerFavoriteRepository: ICustomerFavoriteRepository) {}

  /**
   * Retrieves all saved favorites for the authenticated user.
   */
  async execute(userId: string): Promise<CustomerFavoriteEntity[]> {
    return this.customerFavoriteRepository.findAllByUserId(userId);
  }
}
