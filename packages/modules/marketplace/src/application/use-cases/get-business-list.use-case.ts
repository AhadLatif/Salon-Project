import type {
  IMarketplaceQueryService,
  PublicBusinessProfileDto,
} from '../ports/marketplace-query.port.js';

export class GetBusinessListUseCase {
  constructor(private readonly queryService: IMarketplaceQueryService) {}

  async execute(
    limit: number,
    offset: number,
  ): Promise<{ items: PublicBusinessProfileDto[]; total: number }> {
    return await this.queryService.listBusinesses(limit, offset);
  }
}
