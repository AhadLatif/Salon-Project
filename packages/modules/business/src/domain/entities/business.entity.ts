export type BusinessStatus = 'pending' | 'active' | 'suspended' | 'archived';

/**
 * Persisted shape of a business tenant.
 *
 * CONTRACT — `BusinessEntity` maps 1:1 onto the columns of the `businesses` table
 * (`packages/infrastructure/database/src/schema/business/businesses.ts`).
 *
 * WHY THIS RULE EXISTS: this interface used to carry an `ownerUserId` that is **not a column**.
 * It was synthesised by the repository with a SECOND query (a join over `business_members` +
 * `business_roles`) on every read — including `findById`, which the tenant middleware calls on
 * every tenant-scoped request — and `getUserBusinesses` filled it with the **caller's** id rather
 * than the owner's, so the field silently lied about who owned the business. No code path ever
 * read it; it was pure cost plus a latent authorization hazard.
 *
 * INVARIANT: every property here must be assignable directly from a `businesses` row — no lookups,
 * no derivation, no joins. Data that cannot satisfy that belongs in an explicitly named query
 * method (see `IBusinessRepository.getOwnerUserId`), never in a type that claims to describe a row.
 *
 * WHY AN INTERFACE RATHER THAN A CLASS (DOMAIN MODEL CONTRACT):
 * This was a class holding `props` behind twelve getters with a `toPrimitives()` escape hatch. It
 * carried no behaviour — nine of those getters had no caller at all — while costing two real bugs:
 *   1. TypeScript's `private` is erased at runtime, so the instance physically held `{ props: {...} }`.
 *      `JSON.stringify` walks own enumerable properties and never calls prototype getters, so every
 *      HTTP response depended on *remembering* to call `toPrimitives()`. Forget it and the API emits
 *      `{"props":{…}}` — a silently wrong payload, unreachable by any type check.
 *   2. A row had to be copied twice: `row → props` (mapper) and `props → primitives` (serializer).
 * The row IS the domain value, so it is modelled as a shape; `toBusinessResponse` owns what leaves
 * the module. A `class` is reserved for types that own behaviour across operations — a bag of
 * fields is a shape, not an object.
 */
export interface BusinessEntity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  email: string;
  phoneNumber: string;
  status: BusinessStatus;
  isPublished: boolean;
  socialLinks: Record<string, string> | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
