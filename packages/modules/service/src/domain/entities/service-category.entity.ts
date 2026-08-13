import { ValidationError } from '@salon/shared';

export interface ServiceCategoryProps {
  id?: string | undefined;
  businessId: string;
  name: string;
  description?: string | null | undefined;
  displayOrder?: number | undefined;
  isActive?: boolean | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export class ServiceCategoryEntity {
  public readonly id?: string | undefined;
  public readonly businessId: string;
  public readonly name: string;
  public readonly description: string | null;
  public readonly displayOrder: number;
  public readonly isActive: boolean;
  public readonly createdAt?: Date | undefined;
  public readonly updatedAt?: Date | undefined;

  constructor(props: ServiceCategoryProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.name = props.name;
    this.description = props.description ?? null;
    this.displayOrder = props.displayOrder ?? 0;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.validate();
  }

  private validate(): void {
    if (!this.businessId) {
      throw new ValidationError(
        'Category must belong to a business tenant (businessId is required).',
        { businessId: 'Required' },
      );
    }
    if (!this.name || this.name.trim().length === 0) {
      throw new ValidationError('Category name cannot be empty.', { name: 'Cannot be empty' });
    }
    if (this.name.length > 100) {
      throw new ValidationError('Category name cannot exceed 100 characters.', {
        name: 'Too long',
      });
    }
    if (this.displayOrder < 0 || !Number.isInteger(this.displayOrder)) {
      throw new ValidationError('Display order cannot be negative and must be an integer.', {
        displayOrder: 'Must be an integer >= 0',
      });
    }
    if (this.description && this.description.length > 500) {
      throw new ValidationError('Description cannot exceed 500 characters.', {
        description: 'Too long',
      });
    }
  }

  public toPrimitives(): Record<string, unknown> {
    return {
      id: this.id,
      businessId: this.businessId,
      name: this.name,
      description: this.description,
      displayOrder: this.displayOrder,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
