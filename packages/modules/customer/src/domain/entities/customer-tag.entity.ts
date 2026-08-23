export interface CustomerTagEntity {
  id: string;
  businessId: string;
  name: string;
  color: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerTagAssignmentEntity {
  businessId: string;
  businessCustomerId: string;
  customerTagId: string;
  assignedBy: string | null;
  assignedAt: Date;
}
