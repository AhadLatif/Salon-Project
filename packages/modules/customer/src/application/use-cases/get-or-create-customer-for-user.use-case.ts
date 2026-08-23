import { ConflictError } from '@salon/shared';
import type { BusinessCustomerEntity } from '../../domain/entities/customer.entity.js';
import type { ICustomerRepository } from '../ports/customer-repository.port.js';

export interface GetOrCreateCustomerInput {
  businessId: string;
  userId?: string | null;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
}

/**
 * Dedicated use case for marketplace & booking engine onboarding.
 * Ensures a customer profile exists for the user in the target salon tenant.
 *
 * OWNERSHIP GUARD: A profile matched by email/phone is only returned to the
 * caller when it is already linked to that caller's userId, or when it is an
 * unlinked walk-in/guest profile that we atomically claim (CAS on user_id IS NULL).
 * We NEVER return another user's linked profile — that would leak CRM data
 * across B2C accounts.
 */
export class GetOrCreateCustomerForUserUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(input: GetOrCreateCustomerInput): Promise<BusinessCustomerEntity> {
    const trimmedEmail = input.email ? input.email.trim().toLowerCase() : null;
    const trimmedPhone = input.phoneNumber ? input.phoneNumber.trim() : null;

    // 1. Check if user already has a linked customer profile in this business
    if (input.userId) {
      const existingUserCustomer = await this.customerRepository.findByUserId(
        input.businessId,
        input.userId,
      );
      if (existingUserCustomer) {
        return existingUserCustomer;
      }
    }

    // 2. Check if a profile exists by email
    if (trimmedEmail) {
      const existingByEmail = await this.customerRepository.findByEmail(
        input.businessId,
        trimmedEmail,
      );

      if (existingByEmail) {
        // If the profile is already linked to a DIFFERENT user, we must not
        // return it — the caller would see another account's CRM data.
        if (existingByEmail.userId && existingByEmail.userId !== input.userId) {
          // Fall through to phone check / create instead of leaking the profile.
          return this.findOrCreateByPhoneOrNew(input, trimmedPhone, trimmedEmail);
        }

        // Claim an anonymous walk-in profile for the authenticated user by
        // linking the userId. CAS ensures we only win when user_id is STILL NULL.
        if (input.userId && !existingByEmail.userId) {
          const claimed = await this.customerRepository.claimForUser(
            input.businessId,
            existingByEmail.id,
            input.userId,
          );
          if (claimed) {
            return claimed;
          }
          // Another request claimed the profile concurrently — reload and verify
          // ownership before falling through.
          const reloaded = await this.customerRepository.findById(
            input.businessId,
            existingByEmail.id,
          );
          if (reloaded?.userId === input.userId) {
            return reloaded;
          }
          throw new ConflictError('This customer profile is already linked to another account');
        }

        // No userId provided: return the unlinked walk-in profile as-is.
        return existingByEmail;
      }
    }

    return this.findOrCreateByPhoneOrNew(input, trimmedPhone, trimmedEmail);
  }

  private async findOrCreateByPhoneOrNew(
    input: GetOrCreateCustomerInput,
    trimmedPhone: string | null,
    trimmedEmail: string | null,
  ): Promise<BusinessCustomerEntity> {
    // 3. Check if a profile exists by phone number
    if (trimmedPhone) {
      const existingByPhone = await this.customerRepository.findByPhoneOrEmail(input.businessId, {
        phoneNumber: trimmedPhone,
      });

      if (existingByPhone) {
        // Same ownership guard: never return another user's linked profile.
        if (existingByPhone.userId && existingByPhone.userId !== input.userId) {
          throw new ConflictError('This customer profile is already linked to another account');
        }

        // Claim an unlinked walk-in profile matched by phone.
        if (input.userId && !existingByPhone.userId) {
          const claimed = await this.customerRepository.claimForUser(
            input.businessId,
            existingByPhone.id,
            input.userId,
          );
          if (claimed) {
            return claimed;
          }
          const reloaded = await this.customerRepository.findById(
            input.businessId,
            existingByPhone.id,
          );
          if (reloaded?.userId === input.userId) {
            return reloaded;
          }
          throw new ConflictError('This customer profile is already linked to another account');
        }

        return existingByPhone;
      }
    }

    // 4. Create new customer record
    return this.customerRepository.create({
      businessId: input.businessId,
      userId: input.userId ?? null,
      firstName: input.firstName.trim(),
      lastName: input.lastName ? input.lastName.trim() : null,
      email: trimmedEmail,
      phoneNumber: trimmedPhone,
    });
  }
}
