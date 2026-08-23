export interface CustomerNoteEntity {
  id: string;
  businessId: string;
  businessCustomerId: string;
  authorId: string | null;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}
