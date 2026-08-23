import type {
  BusinessCustomerEntity,
  CustomerFavoriteEntity,
  CustomerNoteEntity,
  CustomerStatus,
  CustomerTagAssignmentEntity,
  CustomerTagEntity,
  CustomerWithTagsEntity,
} from '../../domain/entities/index.js';

export interface CreateCustomerData {
  businessId: string;
  userId?: string | null | undefined;
  firstName: string;
  lastName?: string | null | undefined;
  phoneNumber?: string | null | undefined;
  email?: string | null | undefined;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | undefined;
  dateOfBirth?: string | null | undefined;
  marketingOptIn?: boolean | undefined;
}

export interface UpdateCustomerData {
  firstName?: string | undefined;
  lastName?: string | null | undefined;
  phoneNumber?: string | null | undefined;
  email?: string | null | undefined;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | undefined;
  dateOfBirth?: string | null | undefined;
  marketingOptIn?: boolean | undefined;
  // Used by GetOrCreateCustomerForUserUseCase to claim an existing profile
  // (e.g. a walk-in matched by email) for a B2C user account.
  userId?: string | null | undefined;
}

export interface GetCustomersFilter {
  search?: string | undefined;
  status?: CustomerStatus | undefined;
  tagId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface PaginatedCustomers {
  customers: BusinessCustomerEntity[];
  total: number;
}

export interface ICustomerRepository {
  create(data: CreateCustomerData): Promise<BusinessCustomerEntity>;
  findById(businessId: string, customerId: string): Promise<BusinessCustomerEntity | null>;
  findDetailsById(businessId: string, customerId: string): Promise<CustomerWithTagsEntity | null>;
  findByEmail(businessId: string, email: string): Promise<BusinessCustomerEntity | null>;
  findByPhoneOrEmail(
    businessId: string,
    criteria: { phoneNumber?: string | undefined; email?: string | undefined },
  ): Promise<BusinessCustomerEntity | null>;
  findByUserId(businessId: string, userId: string): Promise<BusinessCustomerEntity | null>;
  /**
   * Atomically links an unlinked (walk-in/guest) customer profile to a B2C user.
   * Compare-and-swap: only succeeds when the profile's user_id is still NULL.
   * Returns null when another request claimed the profile first.
   */
  claimForUser(
    businessId: string,
    customerId: string,
    userId: string,
  ): Promise<BusinessCustomerEntity | null>;
  findAll(businessId: string, filter?: GetCustomersFilter): Promise<PaginatedCustomers>;
  update(
    businessId: string,
    customerId: string,
    data: UpdateCustomerData,
  ): Promise<BusinessCustomerEntity | null>;
  archive(businessId: string, customerId: string): Promise<BusinessCustomerEntity | null>;
}

export interface CreateCustomerNoteData {
  businessId: string;
  businessCustomerId: string;
  authorId?: string | null | undefined;
  note: string;
}

export interface ICustomerNoteRepository {
  create(data: CreateCustomerNoteData): Promise<CustomerNoteEntity>;
  findById(
    businessId: string,
    customerId: string,
    noteId: string,
  ): Promise<CustomerNoteEntity | null>;
  findAllByCustomerId(businessId: string, customerId: string): Promise<CustomerNoteEntity[]>;
  delete(businessId: string, customerId: string, noteId: string): Promise<boolean>;
}

export interface CreateCustomerTagData {
  businessId: string;
  name: string;
  color?: string | null | undefined;
  description?: string | null | undefined;
}

export interface ICustomerTagRepository {
  create(data: CreateCustomerTagData): Promise<CustomerTagEntity>;
  findById(businessId: string, tagId: string): Promise<CustomerTagEntity | null>;
  findByName(businessId: string, name: string): Promise<CustomerTagEntity | null>;
  findAll(businessId: string): Promise<CustomerTagEntity[]>;
  delete(businessId: string, tagId: string): Promise<boolean>;
  assignTag(
    businessId: string,
    customerId: string,
    tagId: string,
    assignedBy?: string | null | undefined,
  ): Promise<CustomerTagAssignmentEntity>;
  unassignTag(businessId: string, customerId: string, tagId: string): Promise<boolean>;
  findCustomerTags(businessId: string, customerId: string): Promise<CustomerTagEntity[]>;
}

export interface CreateCustomerFavoriteData {
  userId: string;
  businessId?: string | null | undefined;
  staffMemberId?: string | null | undefined;
}

export interface ICustomerFavoriteRepository {
  create(data: CreateCustomerFavoriteData): Promise<CustomerFavoriteEntity>;
  findById(id: string, userId: string): Promise<CustomerFavoriteEntity | null>;
  findByTarget(
    userId: string,
    target: { businessId?: string | null | undefined; staffMemberId?: string | null | undefined },
  ): Promise<CustomerFavoriteEntity | null>;
  findAllByUserId(userId: string): Promise<CustomerFavoriteEntity[]>;
  delete(id: string, userId: string): Promise<boolean>;
}
