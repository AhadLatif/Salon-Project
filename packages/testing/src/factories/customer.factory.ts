import { randomUUID } from 'node:crypto';
import {
  businessCustomers,
  customerFavorites,
  customerNotes,
  customerTags,
  type Database,
  db as defaultDb,
} from '@salon/database';

export interface TestCustomerOverrides {
  id?: string;
  userId?: string | null;
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  dateOfBirth?: string | null;
  status?: 'active' | 'blocked' | 'archived';
  marketingOptIn?: boolean;
}

export async function createTestCustomer(
  dbClient: Database = defaultDb,
  businessId: string,
  overrides: TestCustomerOverrides = {},
) {
  const uniqueId = randomUUID().substring(0, 8);

  const [customer] = await dbClient
    .insert(businessCustomers)
    .values({
      id: overrides.id || randomUUID(),
      businessId,
      userId: overrides.userId ?? null,
      firstName: overrides.firstName || `Customer_${uniqueId}`,
      lastName: overrides.lastName !== undefined ? overrides.lastName : 'Test',
      email: overrides.email !== undefined ? overrides.email : `cust_${uniqueId}@example.com`,
      phoneNumber: overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+1234567890',
      gender: overrides.gender || 'prefer_not_to_say',
      dateOfBirth: overrides.dateOfBirth ?? null,
      status: overrides.status || 'active',
      marketingOptIn: overrides.marketingOptIn ?? false,
    })
    .returning();

  if (!customer) {
    throw new Error('Failed to create test customer.');
  }

  return customer;
}

export interface TestCustomerNoteOverrides {
  id?: string;
  authorId?: string | null;
  note?: string;
}

export async function createTestCustomerNote(
  dbClient: Database = defaultDb,
  businessId: string,
  businessCustomerId: string,
  overrides: TestCustomerNoteOverrides = {},
) {
  const [note] = await dbClient
    .insert(customerNotes)
    .values({
      id: overrides.id || randomUUID(),
      businessId,
      businessCustomerId,
      authorId: overrides.authorId ?? null,
      note: overrides.note || 'Test internal note text',
    })
    .returning();

  if (!note) {
    throw new Error('Failed to create test customer note.');
  }

  return note;
}

export interface TestCustomerTagOverrides {
  id?: string;
  name?: string;
  color?: string | null;
  description?: string | null;
}

export async function createTestCustomerTag(
  dbClient: Database = defaultDb,
  businessId: string,
  overrides: TestCustomerTagOverrides = {},
) {
  const uniqueId = randomUUID().substring(0, 8);

  const [tag] = await dbClient
    .insert(customerTags)
    .values({
      id: overrides.id || randomUUID(),
      businessId,
      name: overrides.name || `Tag_${uniqueId}`,
      color: overrides.color !== undefined ? overrides.color : '#FF5733',
      description:
        overrides.description !== undefined ? overrides.description : 'Test tag description',
    })
    .returning();

  if (!tag) {
    throw new Error('Failed to create test customer tag.');
  }

  return tag;
}

export interface TestCustomerFavoriteOverrides {
  id?: string;
  businessId?: string | null;
  staffMemberId?: string | null;
}

export async function createTestCustomerFavorite(
  dbClient: Database = defaultDb,
  userId: string,
  overrides: TestCustomerFavoriteOverrides = {},
) {
  const [favorite] = await dbClient
    .insert(customerFavorites)
    .values({
      id: overrides.id || randomUUID(),
      userId,
      businessId: overrides.businessId ?? null,
      staffMemberId: overrides.staffMemberId ?? null,
    })
    .returning();

  if (!favorite) {
    throw new Error('Failed to create test customer favorite.');
  }

  return favorite;
}
