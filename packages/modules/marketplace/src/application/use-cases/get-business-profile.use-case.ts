import { ResourceNotFoundError } from '@salon/shared';
import type {
  IMarketplaceQueryService,
  PublicBusinessProfileDto,
} from '../ports/marketplace-query.port.js';

export class GetBusinessProfileUseCase {
  constructor(private readonly queryService: IMarketplaceQueryService) {}

  async execute(slug: string): Promise<PublicBusinessProfileDto> {
    const profile = await this.queryService.getBusinessProfileBySlug(slug);

    if (!profile) {
      // We purposefully don't distinguish between "doesn't exist" and "hidden"
      // to prevent enumeration attacks.
      throw new ResourceNotFoundError('Salon Not Found');
    }

    return profile;
  }
}
