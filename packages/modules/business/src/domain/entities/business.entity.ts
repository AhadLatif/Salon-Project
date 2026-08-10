export interface BusinessProps {
  id: string;
  ownerUserId: string;
  slug: string;
  name: string;
  description?: string | null;
  email: string;
  phoneNumber: string;
  status: 'pending' | 'active' | 'suspended' | 'archived';
  socialLinks?: Record<string, string> | null;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class BusinessEntity {
  constructor(private readonly props: BusinessProps) {}

  get id(): string {
    return this.props.id;
  }
  get ownerUserId(): string {
    return this.props.ownerUserId;
  }
  get slug(): string {
    return this.props.slug;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null | undefined {
    return this.props.description;
  }
  get email(): string {
    return this.props.email;
  }
  get phoneNumber(): string {
    return this.props.phoneNumber;
  }
  get status(): 'pending' | 'active' | 'suspended' | 'archived' {
    return this.props.status;
  }
  get socialLinks(): Record<string, string> | null | undefined {
    return this.props.socialLinks;
  }
  get verifiedAt(): Date | null | undefined {
    return this.props.verifiedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toPrimitives(): BusinessProps {
    return { ...this.props };
  }
}
