export type CustomerStatus = 'active' | 'blocked' | 'archived';
export type CustomerGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface BusinessCustomerEntity {
  id: string;
  businessId: string;
  userId: string | null;
  firstName: string;
  lastName: string | null;
  phoneNumber: string | null;
  email: string | null;
  gender: CustomerGender;
  dateOfBirth: string | null;
  status: CustomerStatus;
  marketingOptIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerWithTagsEntity extends BusinessCustomerEntity {
  tags: Array<{
    id: string;
    name: string;
    color: string | null;
    description: string | null;
    assignedAt: Date;
  }>;
}
