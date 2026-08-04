// `Error.captureStackTrace` is a V8-only extension not present in the ES2024
// standard library types. Access it through a typed view so we don't need
// `types/node` (keeps this package framework-agnostic) or `ts-ignore`.
interface ErrorConstructorWithCaptureStackTrace {
  captureStackTrace?(error: object, ctor?: new (...args: never) => unknown): void;
}

const v8CaptureStackTrace = (Error as ErrorConstructor & ErrorConstructorWithCaptureStackTrace)
  .captureStackTrace;

/** Options accepted by the {@link AppError} constructor. */
export interface AppErrorOptions {
  readonly code?: string;
  readonly details?: unknown;
  readonly cause?: unknown;
  readonly isOperational?: boolean;
}

/**
 * Central application error hierarchy for the platform.
 *
 * Design goals:
 * - NO HTTP STATUS CODES. Keep the domain layer framework-agnostic.
 * - Expose a stable machine-readable error `code`.
 * - Preserve the original `cause` when an error is rethrown.
 * - Distinguish expected operational errors from unexpected bugs.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    { code = 'INTERNAL_ERROR', details, cause, isOperational = true }: AppErrorOptions = {},
  ) {
    // ES2024 supports ErrorOptions.cause natively; build the options object
    // conditionally so it's valid under `exactOptionalPropertyTypes`.
    const errorOptions: ErrorOptions = {};
    if (cause !== undefined) {
      errorOptions.cause = cause;
    }
    super(message, errorOptions);

    // `new.target.name` is more robust than `this.constructor.name`
    // (survives minification/transpilation better).
    this.name = new.target.name;
    this.code = code;
    this.isOperational = isOperational;
    if (details !== undefined) {
      this.details = details;
    }

    // `captureStackTrace` is V8-only; guard for other runtimes.
    v8CaptureStackTrace?.(this, new.target);
  }

  /**
   * Stable serialization for the global error handler / logging.
   * Keeps the domain layer framework-agnostic.
   */
  toJSON(): Record<string, unknown> {
    const json: Record<string, unknown> = {
      name: this.name,
      message: this.message,
      code: this.code,
    };

    if (this.details !== undefined) {
      json.details = this.details;
    }
    if (this.cause !== undefined) {
      json.cause = this.cause instanceof Error ? this.cause.message : this.cause;
    }
    // Surface stack traces only for non-operational (programmer) errors.
    if (!this.isOperational) {
      json.stack = this.stack;
    }

    return json;
  }
}

/** Type guard: narrows an unknown thrown value to {@link AppError}. */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

// --- DOMAIN & APPLICATION ERRORS (Expected Business Rule Violations) ---

export class ResourceNotFoundError extends AppError {
  constructor(message = 'Resource not found', options: Omit<AppErrorOptions, 'code'> = {}) {
    super(message, { ...options, code: 'NOT_FOUND' });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, { code: 'VALIDATION_ERROR', details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, { code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, { code: 'FORBIDDEN' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict detected') {
    super(message, { code: 'CONFLICT' });
  }
}

/**
 * IDOR Protection: Thrown when a user tries to access another tenant's data.
 * The Global Error Handler will map this to 404 to obscure the database.
 */
export class TenantIsolationError extends AppError {
  constructor(message = 'Resource not found or access denied') {
    super(message, { code: 'TENANT_ISOLATION_VIOLATION' });
  }
}

// --- INFRASTRUCTURE ERRORS (Unexpected Technical Failures) ---

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', cause?: unknown) {
    super(message, { code: 'DATABASE_ERROR', cause, isOperational: true });
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = 'External service failed', cause?: unknown) {
    super(message, { code: 'EXTERNAL_SERVICE_ERROR', cause, isOperational: true });
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', cause?: unknown) {
    super(message, { code: 'INTERNAL_SERVER_ERROR', cause, isOperational: false });
  }
}
