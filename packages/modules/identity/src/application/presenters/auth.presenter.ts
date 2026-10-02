import type { UserEntity } from '../../domain/entities/user.entity.js';

/**
 * Shapes the user returned by register / login.
 *
 * WHY THIS EXISTS: the auth controller used to hand-pick `{ id, email, fullName }` inline, with
 * `fullName` coming from a getter on the old `UserEntity`. Both problems are fixed here at once:
 *   1. There is exactly one place that decides what an auth response exposes.
 *   2. `fullName` is derived HERE rather than stored on the entity, so the derivation and the response
 *      contract cannot drift apart. The expression is byte-for-byte the old getter's
 *      (`` `${firstName} ${lastName}`.trim() ``), so the emitted JSON is unchanged.
 *
 * NOTE: `fullName` is not a `users` column — it is not returned anywhere else in the codebase, so
 * nothing else needs this derivation.
 */
export interface AuthUserResponse {
  id: string;
  email: string;
  fullName: string;
}

export function toAuthUserResponse(user: UserEntity): AuthUserResponse {
  return {
    id: user.id,
    email: user.primaryEmail,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
  };
}
