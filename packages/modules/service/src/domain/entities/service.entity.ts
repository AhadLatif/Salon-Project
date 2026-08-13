import { ValidationError } from '@salon/shared';

export interface ServiceProps {
  id?: string | undefined;
  businessId: string;
  categoryId: string;
  name: string;
  description?: string | null | undefined;
  defaultPrice: string; // Stored as string to prevent float precision issues in JS, DB handles numeric(10,2)
  defaultDurationMinutes: number;
  bufferBeforeMinutes?: number | undefined;
  bufferAfterMinutes?: number | undefined;
  color?: string | null | undefined;
  isBookable?: boolean | undefined;
  isActive?: boolean | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export class ServiceEntity {
  public readonly id?: string | undefined;
  public readonly businessId: string;
  public readonly categoryId: string;
  public readonly name: string;
  public readonly description: string | null;
  public readonly defaultPrice: string;
  public readonly defaultDurationMinutes: number;
  public readonly bufferBeforeMinutes: number;
  public readonly bufferAfterMinutes: number;
  public readonly color: string | null;
  public readonly isBookable: boolean;
  public readonly isActive: boolean;
  public readonly createdAt?: Date | undefined;
  public readonly updatedAt?: Date | undefined;

  constructor(props: ServiceProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.categoryId = props.categoryId;
    this.name = props.name;
    this.description = props.description ?? null;
    this.defaultPrice = props.defaultPrice;
    this.defaultDurationMinutes = props.defaultDurationMinutes;
    this.bufferBeforeMinutes = props.bufferBeforeMinutes ?? 0;
    this.bufferAfterMinutes = props.bufferAfterMinutes ?? 0;
    this.color = props.color ?? null;
    this.isBookable = props.isBookable ?? true;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.validate();
  }

  private validate(): void {
    if (!this.businessId) {
      throw new ValidationError(
        'Service must belong to a business tenant (businessId is required).',
        { businessId: 'Required' },
      );
    }
    if (!this.categoryId) {
      throw new ValidationError('Service must belong to a category (categoryId is required).', {
        categoryId: 'Required',
      });
    }
    if (!this.name || this.name.trim().length === 0) {
      throw new ValidationError('Service name cannot be empty.', { name: 'Cannot be empty' });
    }
    if (this.name.length > 150) {
      throw new ValidationError('Service name cannot exceed 150 characters.', { name: 'Too long' });
    }
    if (this.description && this.description.length > 1000) {
      throw new ValidationError('Description cannot exceed 1000 characters.', {
        description: 'Too long',
      });
    }

    // DB: check('chk_services_default_price', sql`${table.defaultPrice} >= 0`)
    if (!/^\d+(\.\d{1,2})?$/.test(this.defaultPrice)) {
      throw new ValidationError(
        'Default price must be a valid positive number with up to 2 decimal places.',
        {
          defaultPrice: 'Invalid format',
        },
      );
    }
    const parsedPrice = parseFloat(this.defaultPrice);
    if (parsedPrice > 99999999.99) {
      throw new ValidationError('Default price cannot exceed 99999999.99', {
        defaultPrice: 'Too high',
      });
    }

    // DB: check('chk_services_duration', sql`${table.defaultDurationMinutes} > 0`)
    if (
      this.defaultDurationMinutes <= 0 ||
      !Number.isInteger(this.defaultDurationMinutes) ||
      this.defaultDurationMinutes > 480
    ) {
      throw new ValidationError('Default duration must be a positive integer between 1 and 480.', {
        defaultDurationMinutes: 'Must be > 0 and <= 480',
      });
    }

    // DB: check('chk_services_buffer_before', sql`${table.bufferBeforeMinutes} >= 0`)
    if (
      this.bufferBeforeMinutes < 0 ||
      !Number.isInteger(this.bufferBeforeMinutes) ||
      this.bufferBeforeMinutes > 120
    ) {
      throw new ValidationError('Buffer before must be an integer between 0 and 120.', {
        bufferBeforeMinutes: 'Must be >= 0 and <= 120',
      });
    }

    // DB: check('chk_services_buffer_after', sql`${table.bufferAfterMinutes} >= 0`)
    if (
      this.bufferAfterMinutes < 0 ||
      !Number.isInteger(this.bufferAfterMinutes) ||
      this.bufferAfterMinutes > 120
    ) {
      throw new ValidationError('Buffer after must be an integer between 0 and 120.', {
        bufferAfterMinutes: 'Must be >= 0 and <= 120',
      });
    }

    if (this.color && !/^#[0-9A-F]{6}$/i.test(this.color)) {
      throw new ValidationError('Color must be a valid hex code (e.g., #FF5733).', {
        color: 'Invalid hex format',
      });
    }
  }

  public toPrimitives(): Record<string, unknown> {
    return {
      id: this.id,
      businessId: this.businessId,
      categoryId: this.categoryId,
      name: this.name,
      description: this.description,
      defaultPrice: this.defaultPrice,
      defaultDurationMinutes: this.defaultDurationMinutes,
      bufferBeforeMinutes: this.bufferBeforeMinutes,
      bufferAfterMinutes: this.bufferAfterMinutes,
      color: this.color,
      isBookable: this.isBookable,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
