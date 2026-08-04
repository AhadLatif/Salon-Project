/**
 * Global Repository Interface
 * Used for platform-level entities that do NOT belong to a specific tenant.
 * Examples: Users, Platform Settings.
 */
export interface IGlobalRepository<TEntity, TInsert, TUpdate, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
  create(data: TInsert): Promise<TEntity>;
  update(id: TId, data: TUpdate): Promise<TEntity>;
  delete(id: TId): Promise<boolean>;
}

/**
 * Tenant Repository Interface (CRITICAL FOR SECURITY)
 * Used for all entities that belong to a specific Business.
 * * Notice that EVERY method strictly requires a `businessId`.
 * This makes it mathematically impossible for a developer to accidentally
 * query data across tenants without explicitly providing the tenant context.
 */
export interface ITenantRepository<TEntity, TInsert, TUpdate, TId = string> {
  findById(businessId: string, id: TId): Promise<TEntity | null>;
  findAll(businessId: string): Promise<TEntity[]>;
  create(businessId: string, data: TInsert): Promise<TEntity>;
  update(businessId: string, id: TId, data: TUpdate): Promise<TEntity>;
  delete(businessId: string, id: TId): Promise<boolean>;
}
