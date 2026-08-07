export interface UserProps {
  id: string;
  firstName: string;
  lastName: string;
  primaryEmail: string;
  primaryPhone?: string | null;
  avatarUrl?: string | null;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export class UserEntity {
  constructor(private readonly props: UserProps) {}

  get id(): string {
    return this.props.id;
  }
  get firstName(): string {
    return this.props.firstName;
  }
  get lastName(): string {
    return this.props.lastName;
  }
  get primaryEmail(): string {
    return this.props.primaryEmail;
  }
  get status(): 'active' | 'suspended' | 'deleted' {
    return this.props.status;
  }
  get avatarUrl(): string | null | undefined {
    return this.props.avatarUrl;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get primaryPhone(): string | null | undefined {
    return this.props.primaryPhone;
  }

  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`.trim();
  }

  toPrimitives(): UserProps {
    return { ...this.props };
  }
}

// TODO: Consider adding a static factory method to create a UserEntity from a database record, if needed.

// return new UserEntity(createdRecord as UserProps);

// function toUserEntity(record: UserRow): UserEntity {
//   return new UserEntity({
//     id: record.id,
//     firstName: record.firstName,
//     lastName: record.lastName,
//     primaryEmail: record.primaryEmail,
//     status: record.status,
//     createdAt: record.createdAt,
//     updatedAt: record.updatedAt,
//   });
// }
