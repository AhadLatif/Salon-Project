import { ConflictError } from '../errors/base.error.js';

export interface PostgresErrorLike {
  code?: string | undefined;
  constraint?: string | undefined;
  constraint_name?: string | undefined;
  detail?: string | undefined;
  message?: string | undefined;
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

/**
 * Catches PostgreSQL exclusion constraint violations (code 23P01, e.g. the GiST
 * `no_staff_time_overlap` constraint on `appointment_service_allocations`) and maps
 * them to a domain `ConflictError`.
 *
 * An exclusion violation is a *persistent* business conflict (someone else already
 * holds the slot), NOT a transient error — so it must surface as a 409, never be
 * blindly retried. This mirrors `handleUniqueConstraint` (23505) but for range overlaps.
 *
 * @param error The caught error in a repository catch block.
 * @param constraintMap Map of constraint name (or substring) -> user-facing conflict error message.
 * @param defaultConflictMessage Optional fallback message if code is 23P01 but no map key matched.
 *
 * If the error is not a code 23P01 (or does not match any constraint), it is re-thrown as-is.
 */
export function handleExclusionViolation(
  error: unknown,
  constraintMap: Record<string, string>,
  defaultConflictMessage?: string,
): never {
  const dbErr = extractPostgresError(error);

  if (dbErr?.code === '23P01') {
    const constraint = dbErr.constraint || dbErr.constraint_name || '';

    if (constraint && Object.hasOwn(constraintMap, constraint)) {
      throw new ConflictError(constraintMap[constraint]);
    }

    for (const [key, message] of Object.entries(constraintMap)) {
      if (constraint.includes(key) || dbErr.message?.includes(key) || dbErr.detail?.includes(key)) {
        throw new ConflictError(message);
      }
    }

    if (defaultConflictMessage) {
      throw new ConflictError(defaultConflictMessage);
    }
  }

  throw error;
}

/**
 * Transient PostgreSQL error codes whose originating transaction may safely be retried.
 *
 * - `40001` serialization_failure (REPEATABLE READ / SERIALIZABLE anomalies)
 * - `40P01` deadlock_detected             (locking cycle detected by Postgres)
 * - `57014` query_canceled                (statement_timeout / lock_timeout aborted)
 *
 * Explicitly excluded: `23P01` exclusion_violation and `23505` unique_violation —
 * those represent persistent business conflicts and must NOT be silently retried.
 */
const RETRYABLE_SQLSTATE = new Set(['40001', '40P01', '57014']);

export function isRetryableDbError(error: unknown): boolean {
  const dbErr = extractPostgresError(error);
  return dbErr?.code ? RETRYABLE_SQLSTATE.has(dbErr.code) : false;
}
