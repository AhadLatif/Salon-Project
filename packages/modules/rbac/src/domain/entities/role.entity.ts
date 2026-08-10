export interface RoleProps {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  displayOrder: number;
  permissions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class RoleEntity {
  public readonly id: string;
  public readonly businessId: string;
  public readonly name: string;
  public readonly description: string | null;
  public readonly isSystem: boolean;
  public readonly displayOrder: number;
  public readonly permissions: string[];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: RoleProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.name = props.name;
    this.description = props.description ?? null;
    this.isSystem = props.isSystem;
    this.displayOrder = props.displayOrder ?? 0;
    this.permissions = props.permissions ?? [];
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  toPrimitives() {
    return {
      id: this.id,
      businessId: this.businessId,
      name: this.name,
      description: this.description,
      isSystem: this.isSystem,
      displayOrder: this.displayOrder,
      permissions: this.permissions,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
