import { randomUUID } from 'node:crypto';
import { type Database, db as defaultDb, serviceCategories, services } from '@salon/database';

export interface TestServiceCategoryOverrides {
  id?: string;
  businessId: string;
  name?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface TestServiceOverrides {
  id?: string;
  businessId: string;
  categoryId?: string; // If omitted, creates one automatically
  name?: string;
  description?: string;
  defaultPrice?: string;
  defaultDurationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  color?: string;
  isBookable?: boolean;
  isActive?: boolean;
}

/**
 * Creates and inserts a test service category record.
 */
export async function createTestServiceCategory(
  dbClient: Database = defaultDb,
  overrides: TestServiceCategoryOverrides,
) {
  const uniqueId = randomUUID().substring(0, 8);

  const [insertedCategory] = await dbClient
    .insert(serviceCategories)
    .values({
      id: overrides.id || randomUUID(),
      businessId: overrides.businessId,
      name: overrides.name || `Category ${uniqueId}`,
      description: overrides.description || 'Test category description',
      displayOrder: overrides.displayOrder ?? 0,
      isActive: overrides.isActive ?? true,
    })
    .returning();

  if (!insertedCategory) {
    throw new Error('Failed to create test service category record.');
  }

  return insertedCategory;
}

/**
 * Creates and inserts a test service record.
 * Automatically provisions a parent category if `categoryId` is omitted.
 */
export async function createTestService(
  dbClient: Database = defaultDb,
  overrides: TestServiceOverrides,
) {
  const uniqueId = randomUUID().substring(0, 8);

  let categoryId = overrides.categoryId;
  if (!categoryId) {
    const category = await createTestServiceCategory(dbClient, {
      businessId: overrides.businessId,
    });
    categoryId = category.id;
  }

  const [insertedService] = await dbClient
    .insert(services)
    .values({
      id: overrides.id || randomUUID(),
      businessId: overrides.businessId,
      categoryId,
      name: overrides.name || `Service ${uniqueId}`,
      description: overrides.description || 'Test service description',
      defaultPrice: overrides.defaultPrice || '50.00',
      defaultDurationMinutes: overrides.defaultDurationMinutes || 60,
      bufferBeforeMinutes: overrides.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: overrides.bufferAfterMinutes ?? 0,
      color: overrides.color || '#336699',
      isBookable: overrides.isBookable ?? true,
      isActive: overrides.isActive ?? true,
    })
    .returning();

  if (!insertedService) {
    throw new Error('Failed to create test service record.');
  }

  return insertedService;
}
