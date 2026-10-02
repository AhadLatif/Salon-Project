import { ValidationError } from '@salon/shared';
import type { ServiceEntity } from '../entities/service.entity.js';

/**
 * Domain invariants for a service offering.
 *
 * WHY A POLICY FUNCTION RATHER THAN A CONSTRUCTOR: these rules used to run inside
 * `ServiceEntity`'s constructor. Because TypeScript erases `private` at runtime and the class only
 * exposed getters, applying validation to a database row forced `row as ServiceProps` — an
 * unchecked cast that would happily accept a shape the entity did not actually describe. A plain
 * function takes the row directly, so no cast is needed and the rules stay identical.
 *
 * NOTE: the rules below are moved VERBATIM from the former `ServiceEntity.validate()`, including the
 * `<= 480` duration ceiling, which the database does NOT enforce (`chk_services_duration` only
 * requires `> 0`) and the `<= 120` buffer bounds (`chk_services_buffer_*` only require `>= 0`).
 * The domain is deliberately stricter than the schema — do not weaken these to match the DB.
 */
export function assertValidService(service: ServiceEntity): void {
  if (!service.businessId) {
    throw new ValidationError(
      'Service must belong to a business tenant (businessId is required).',
      { businessId: 'Required' },
    );
  }
  if (!service.categoryId) {
    throw new ValidationError('Service must belong to a category (categoryId is required).', {
      categoryId: 'Required',
    });
  }
  if (!service.name || service.name.trim().length === 0) {
    throw new ValidationError('Service name cannot be empty.', { name: 'Cannot be empty' });
  }
  if (service.name.length > 150) {
    throw new ValidationError('Service name cannot exceed 150 characters.', { name: 'Too long' });
  }
  if (service.description && service.description.length > 1000) {
    throw new ValidationError('Description cannot exceed 1000 characters.', {
      description: 'Too long',
    });
  }

  // DB: check('chk_services_default_price', sql`${table.defaultPrice} >= 0`)
  if (!/^\d+(\.\d{1,2})?$/.test(service.defaultPrice)) {
    throw new ValidationError(
      'Default price must be a valid positive number with up to 2 decimal places.',
      {
        defaultPrice: 'Invalid format',
      },
    );
  }
  const parsedPrice = parseFloat(service.defaultPrice);
  if (parsedPrice > 99999999.99) {
    throw new ValidationError('Default price cannot exceed 99999999.99', {
      defaultPrice: 'Too high',
    });
  }

  // DB: check('chk_services_duration', sql`${table.defaultDurationMinutes} > 0`)
  if (
    service.defaultDurationMinutes <= 0 ||
    !Number.isInteger(service.defaultDurationMinutes) ||
    service.defaultDurationMinutes > 480
  ) {
    throw new ValidationError('Default duration must be a positive integer between 1 and 480.', {
      defaultDurationMinutes: 'Must be > 0 and <= 480',
    });
  }

  // DB: check('chk_services_buffer_before', sql`${table.bufferBeforeMinutes} >= 0`)
  if (
    service.bufferBeforeMinutes < 0 ||
    !Number.isInteger(service.bufferBeforeMinutes) ||
    service.bufferBeforeMinutes > 120
  ) {
    throw new ValidationError('Buffer before must be an integer between 0 and 120.', {
      bufferBeforeMinutes: 'Must be >= 0 and <= 120',
    });
  }

  // DB: check('chk_services_buffer_after', sql`${table.bufferAfterMinutes} >= 0`)
  if (
    service.bufferAfterMinutes < 0 ||
    !Number.isInteger(service.bufferAfterMinutes) ||
    service.bufferAfterMinutes > 120
  ) {
    throw new ValidationError('Buffer after must be an integer between 0 and 120.', {
      bufferAfterMinutes: 'Must be >= 0 and <= 120',
    });
  }

  if (service.color && !/^#[0-9A-F]{6}$/i.test(service.color)) {
    throw new ValidationError('Color must be a valid hex code (e.g., #FF5733).', {
      color: 'Invalid hex format',
    });
  }
}
