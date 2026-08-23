import { ResourceNotFoundError } from '@salon/shared';
import type { ICustomerFavoriteRepository } from '../ports/customer-repository.port.js';

export class RemoveFavoriteUseCase {
  constructor(private readonly customerFavoriteRepository: ICustomerFavoriteRepository) {}

  /**
   * Removes a saved favorite for the authenticated user.
   */
  async execute(favoriteId: string, userId: string): Promise<boolean> {
    const deleted = await this.customerFavoriteRepository.delete(favoriteId, userId);
    if (!deleted) {
      throw new ResourceNotFoundError('Favorite record not found');
    }

    return true;
  }
}
