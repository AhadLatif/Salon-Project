import { ValidationError } from '@salon/shared';
import type { ServiceCategoryEntity } from '../entities/service-category.entity.js';

/**
 * Domain invariants for a service category.
 *
 * WHY A POLICY FUNCTION RATHER THAN A CONSTRUCTOR: identical reasoning to `service.policy.ts` —
 * the rules used to run inside the entity constructor, and applying them to a row forced an
 * unchecked `row as ServiceCategoryProps` cast. The rules are moved VERBATIM; behaviour (error type,
 * messages, field map) is unchanged.
 */
export function assertValidServiceCategory(category: ServiceCategoryEntity): void {
  if (!category.businessId) {
    throw new ValidationError(
      'Category must belong to a business tenant (businessId is required).',
      { businessId: 'Required' },
    );
  }
  if (!category.name || category.name.trim().length === 0) {
    throw new ValidationError('Category name cannot be empty.', { name: 'Cannot be empty' });
  }
  if (category.name.length > 100) {
    throw new ValidationError('Category name cannot exceed 100 characters.', {
      name: 'Too long',
    });
  }
  if (category.displayOrder < 0 || !Number.isInteger(category.displayOrder)) {
    throw new ValidationError('Display order cannot be negative and must be an integer.', {
      displayOrder: 'Must be an integer >= 0',
    });
  }
  if (category.description && category.description.length > 500) {
    throw new ValidationError('Description cannot exceed 500 characters.', {
      description: 'Too long',
    });
  }
}
