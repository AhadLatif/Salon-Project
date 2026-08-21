import { ConflictError } from '../errors/base.error.js';

export interface PostgresErrorLike {
  code?: string;
  constraint?: string;
  constraint_name?: string;
  detail?: string;
  message?: string;
}

/**
 * Extracts the underlying Postgres error from an unknown caught error,
 * including unwrapping Drizzle ORM's `DrizzleQueryError` (`error.cause`).
 */
export function extractPostgresError(error: unknown): PostgresErrorLike | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  // Drizzle wraps database errors in DrizzleQueryError where the real driver error is in .cause.
  // The chain can be deeper than one level, so walk it until a driver error code appears.
  let current: object = error;
  const seen = new Set<object>();

  while (!seen.has(current)) {
    seen.add(current);
    if (typeof (current as PostgresErrorLike).code === 'string') {
      return current as PostgresErrorLike;
    }
    const cause = (current as { cause?: unknown }).cause;
    if (typeof cause !== 'object' || cause === null) {
      break;
    }
    current = cause;
  }

  return error as PostgresErrorLike;
}

/**
 * Catches Postgres unique constraint violations (code 23505) and maps them to a domain `ConflictError`.
 *
 * @param error The caught error in a repository catch block.
 * @param constraintMap Map of constraint name (or substring) -> user-facing conflict error message.
 * @param defaultConflictMessage Optional fallback message if code is 23505 but no map key matched.
 *
 * If the error is not a code 23505 (or does not match any constraint), it is re-thrown as-is.
 */
export function handleUniqueConstraint(
  error: unknown,
  constraintMap: Record<string, string>,
  defaultConflictMessage?: string,
): never {
  const dbErr = extractPostgresError(error);

  if (dbErr?.code === '23505') {
    const constraint = dbErr.constraint || dbErr.constraint_name || '';

    // 1. Direct exact match (own properties only)
    if (constraint && Object.hasOwn(constraintMap, constraint)) {
      throw new ConflictError(constraintMap[constraint]);
    }

    // 2. Partial match across constraint, message, or detail
    for (const [key, message] of Object.entries(constraintMap)) {
      if (constraint.includes(key) || dbErr.message?.includes(key) || dbErr.detail?.includes(key)) {
        throw new ConflictError(message);
      }
    }

    // 3. Fallback default conflict message if provided
    if (defaultConflictMessage) {
      throw new ConflictError(defaultConflictMessage);
    }
  }

  throw error;
}
