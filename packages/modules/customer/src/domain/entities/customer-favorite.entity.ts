export interface CustomerFavoriteEntity {
  id: string;
  userId: string;
  businessId: string | null;
  staffMemberId: string | null;
  createdAt: Date;
}
