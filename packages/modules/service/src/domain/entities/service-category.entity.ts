/**
 * A grouping for service offerings (e.g. "Haircuts", "Coloring").
 *
 * CONTRACT — maps 1:1 onto the columns of the `service_categories` table
 * (`packages/infrastructure/database/src/schema/service/service_categories.ts`).
 *
 * WHY AN INTERFACE RATHER THAN A CLASS: same reasoning as `ServiceEntity` — the class carried no
 * behaviour beyond a constructor-time `validate()` and a `toPrimitives()` serializer, and its
 * runtime shape (`{ props: {...} }`) made a forgotten `toPrimitives()` produce a silently wrong
 * HTTP payload.
 *
 * INVARIANTS live in `domain/policies/service-category.policy.ts`.
 */
export interface ServiceCategoryEntity {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
