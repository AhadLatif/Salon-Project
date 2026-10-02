/**
 * A platform user account.
 *
 * CONTRACT — maps 1:1 onto the `users` row.
 *
 * WHY AN INTERFACE RATHER THAN A CLASS: the old `UserEntity` kept everything in a private `props` bag
 * behind ten getters. Because TypeScript erases `private` at runtime, the instance was physically
 * `{ props: {...} }` and `JSON.stringify` would have emitted that wrapper — so every response depended
 * on someone remembering to call `toPrimitives()`. A user is a bag of fields, so it is a shape.
 *
 * `fullName` IS NOT A FIELD. It was a derived getter (`firstName + lastName`); it is now derived where
 * it is actually consumed — in `toAuthUserResponse` — so the derivation and the response contract can
 * never drift apart. No caller reads it anywhere else.
 */
export interface UserEntity {
  id: string;
  firstName: string;
  lastName: string;
  primaryEmail: string;
  primaryPhone: string | null;
  avatarUrl: string | null;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}
