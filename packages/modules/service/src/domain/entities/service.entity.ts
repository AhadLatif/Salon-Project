/**
 * A service offering in a tenant's catalog.
 *
 * CONTRACT — maps 1:1 onto the columns of the `services` table
 * (`packages/infrastructure/database/src/schema/service/services.ts`).
 *
 * WHY AN INTERFACE RATHER THAN A CLASS: this was a class whose only behaviour was a private
 * `validate()` called from its constructor, plus a `toPrimitives()` escape hatch. Because
 * TypeScript's `private` is erased at runtime, the instance physically held `{ props: {...} }`;
 * serializing it without calling `toPrimitives()` would have emitted `{"props":{...}}` — a wrong
 * payload that no type check can catch. A service is a bag of fields, so it is modelled as a shape.
 *
 * WHY `id` IS REQUIRED HERE: it used to be optional (`id?`) because the class doubled as a
 * pre-insert builder, which forced every reader to write `service.id as string`. Rows always carry
 * an id, so requiring it removes those casts instead of hiding them.
 *
 * INVARIANTS live in `domain/policies/service.policy.ts` so the same rules can be applied to a row
 * (or to a prospective new service) without constructing an object first.
 */
export interface ServiceEntity {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description: string | null;
  defaultPrice: string;
  defaultDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  color: string | null;
  isBookable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
