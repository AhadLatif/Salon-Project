import type {
  BranchEntity,
  BranchStatus,
  OpeningHourProps,
} from '../../domain/entities/branch.entity.js';

export interface CreateBranchData {
  businessId: string;
  name: string;
  phoneNumber?: string | null | undefined;
  email?: string | null | undefined;
  timezone: string;
  currency: string;
  addressLine1: string;
  addressLine2?: string | null | undefined;
  city: string;
  state?: string | null | undefined;
  postalCode?: string | null | undefined;
  countryCode: string;
  latitude?: string | null | undefined;
  longitude?: string | null | undefined;
  openingHours: Omit<OpeningHourProps, 'id' | 'businessId' | 'branchId'>[];
}

export interface UpdateBranchData {
  name?: string | undefined;
  phoneNumber?: string | null | undefined;
  email?: string | null | undefined;
  timezone?: string | undefined;
  currency?: string | undefined;
  addressLine1?: string | undefined;
  addressLine2?: string | null | undefined;
  city?: string | undefined;
  state?: string | null | undefined;
  postalCode?: string | null | undefined;
  countryCode?: string | undefined;
  latitude?: string | null | undefined;
  longitude?: string | null | undefined;
  status?: BranchStatus | undefined;
}

export interface IBranchRepository {
  /**
   * Creates a new branch and its associated opening hours in a single transaction.
   * Ensures atomicity so we never have a branch without hours.
   */
  create(data: CreateBranchData): Promise<BranchEntity>;

  /**
   * Retrieves a branch by its ID and tenant ID (IDOR protection).
   */
  findById(businessId: string, branchId: string): Promise<BranchEntity | null>;

  /**
   * Retrieves all branches for a given tenant.
   */
  findAllByBusinessId(businessId: string): Promise<BranchEntity[]>;

  /**
   * Updates core branch details (address, name, etc).
   */
  update(
    businessId: string,
    branchId: string,
    data: UpdateBranchData,
  ): Promise<BranchEntity | null>;

  /**
   * Fully replaces the opening hours for a branch.
   * (Standard practice for schedules is to delete old and insert new, within a transaction).
   */
  replaceOpeningHours(
    businessId: string,
    branchId: string,
    hours: Omit<OpeningHourProps, 'id' | 'businessId' | 'branchId'>[],
  ): Promise<BranchEntity | null>;

  /**
   * Archives a branch (soft delete) by setting its status to 'archived'.
   * Archived branches are excluded from findById and findAllByBusinessId.
   */
  delete(businessId: string, branchId: string): Promise<boolean>;
}
