import { describe, expect, it } from 'vitest';
import { ConflictError } from '../src/errors/base.error.js';
import {
  extractPostgresError,
  handleExclusionViolation,
  handleUniqueConstraint,
  isRetryableDbError,
} from '../src/utils/database-error.util.js';

class MockDatabaseError extends Error {
  code: string;
  constraint?: string | undefined;
  detail?: string | undefined;

  constructor(
    code: string,
    constraint?: string | undefined,
    detail?: string | undefined,
    customMessage?: string | undefined,
  ) {
    super(customMessage ?? `Database error: ${code}`);
    this.name = 'DatabaseError';
    this.code = code;
    this.constraint = constraint;
    this.detail = detail;
  }
}

class MockDrizzleQueryError extends Error {
  override cause: MockDatabaseError;

  constructor(cause: MockDatabaseError) {
    super('DrizzleQueryError: query failed', { cause });
    this.name = 'DrizzleQueryError';
    this.cause = cause;
  }
}

function makePgError(
  code: string,
  constraint?: string,
  detail?: string,
  customMessage?: string,
): MockDrizzleQueryError {
  return new MockDrizzleQueryError(new MockDatabaseError(code, constraint, detail, customMessage));
}

describe('handleExclusionViolation', () => {
  const constraintMap = { no_staff_time_overlap: 'This time slot is no longer available.' };

  it('throws ConflictError when SQLSTATE is 23P01 and constraint matches exactly', () => {
    const error = makePgError('23P01', 'no_staff_time_overlap');
    expect(() => handleExclusionViolation(error, constraintMap)).toThrow(ConflictError);
    expect(() => handleExclusionViolation(error, constraintMap)).toThrow(
      'This time slot is no longer available.',
    );
  });

  it('matches when the constraint name field equals a map key', () => {
    const error = makePgError('23P01', 'no_staff_time_overlap');
    expect(() => handleExclusionViolation(error, constraintMap)).toThrow(ConflictError);
  });

  it('matches when the map key appears as a substring of the pg error message', () => {
    const error = makePgError('23P01', undefined, undefined, 'no_staff_time_overlap in message');
    expect(() => handleExclusionViolation(error, constraintMap)).toThrow(ConflictError);
  });

  it('matches when the map key appears as a substring of the pg error detail', () => {
    const error = makePgError('23P01', undefined, 'conflicts with no_staff_time_overlap');
    expect(() => handleExclusionViolation(error, constraintMap)).toThrow(ConflictError);
  });

  it('throws the default message when 23P01 matches no constraint key', () => {
    const error = makePgError('23P01', 'some_other_exclusion');
    expect(() => handleExclusionViolation(error, constraintMap, 'Default slot conflict.')).toThrow(
      'Default slot conflict.',
    );
  });

  it('rethrows the original error when 23P01 has no match and no default', () => {
    const error = makePgError('23P01', 'some_other_exclusion');
    expect(() => handleExclusionViolation(error, constraintMap)).toThrow(error);
  });

  it('rethrows non-exclusion errors as-is (e.g. unique violation 23505)', () => {
    const error = makePgError('23505', 'uq_bus_customers_email');
    expect(() => handleExclusionViolation(error, constraintMap)).toThrow(error);
  });

  it('unwraps a DrizzleQueryError cause chain before matching', () => {
    const error = {
      name: 'DrizzleQueryError',
      message: 'DrizzleQueryError: query failed',
      cause: {
        name: 'DatabaseError',
        message: 'conflicting key value violates exclusion constraint',
        cause: { code: '23P01', constraint: 'no_staff_time_overlap' },
      },
    };
    expect(() => handleExclusionViolation(error, constraintMap)).toThrow(ConflictError);
  });
});

describe('handleUniqueConstraint (regression guard)', () => {
  it('still maps 23505 to ConflictError', () => {
    const error = makePgError('23505', 'uq_bus_customers_email');
    expect(() => handleUniqueConstraint(error, { uq_bus_customers_email: 'Duplicate.' })).toThrow(
      ConflictError,
    );
  });
});

describe('isRetryableDbError', () => {
  it.each(['40001', '40P01', '57014'])('returns true for transient SQLSTATE %s', (code) => {
    expect(isRetryableDbError(makePgError(code))).toBe(true);
  });

  it.each(['23P01', '23505', '42P01'])('returns false for persistent SQLSTATE %s', (code) => {
    expect(isRetryableDbError(makePgError(code))).toBe(false);
  });

  it('returns false for non-PostgreSQL errors', () => {
    expect(isRetryableDbError(new Error('plain error'))).toBe(false);
    expect(isRetryableDbError(null)).toBe(false);
    expect(isRetryableDbError('not an error')).toBe(false);
  });

  it('returns false when no code is present', () => {
    expect(isRetryableDbError({ constraint: 'no_staff_time_overlap' })).toBe(false);
  });
});

describe('extractPostgresError', () => {
  it('finds the driver error nested inside a DrizzleQueryError', () => {
    const error = makePgError('23P01', 'no_staff_time_overlap');
    const extracted = extractPostgresError(error);
    expect(extracted?.code).toBe('23P01');
    expect(extracted?.constraint).toBe('no_staff_time_overlap');
  });

  it('returns null for non-object errors', () => {
    expect(extractPostgresError('boom')).toBeNull();
    expect(extractPostgresError(null)).toBeNull();
  });
});
