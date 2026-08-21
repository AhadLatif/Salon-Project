import { ValidationError } from '../errors/base.error.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a string (typically an HTTP route or query parameter) is a valid UUID.
 * Throws a domain `ValidationError` with structured field errors if invalid.
 */
export function parseUuidParam(value: unknown, paramName: string): string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new ValidationError(`Invalid ${paramName} format`, {
      [paramName]: 'Must be a valid UUID.',
    });
  }
  return value;
}

/**
 * Safely extracts and validates a UUID route parameter from an Express request.
 * Automatically handles `string | string[] | undefined` parameter shapes.
 * Throws a domain `ValidationError` if the parameter is missing or not a valid UUID.
 */
export function getUuidParam(
  req: { params?: Record<string, string | string[] | undefined> },
  paramName: string,
): string {
  const rawValue = req.params?.[paramName];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (!value) {
    throw new ValidationError(`Missing ${paramName} parameter`, {
      [paramName]: `${paramName} is required.`,
    });
  }

  return parseUuidParam(value, paramName);
}

/**
 * Safely extracts and validates a UUID **query** parameter from an Express request.
 * Mirrors `getUuidParam` but reads from `req.query`, which is optional and may be unset
 * (so a missing query param throws a clear ValidationError instead of silently parsing `undefined`).
 */
export function getUuidQuery(
  // Accepts the broadest Express query shape (ParsedQs) — runtime narrowing
  // inside `parseUuidParam` handles non-string values (nested objects, arrays).
  req: { query?: Record<string, unknown> },
  paramName: string,
): string {
  const rawValue = req.query?.[paramName];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (!value) {
    throw new ValidationError(`Missing ${paramName} parameter`, {
      [paramName]: `${paramName} is required.`,
    });
  }

  return parseUuidParam(value, paramName);
}

export interface ZodIssueLike {
  path: readonly PropertyKey[] | PropertyKey[];
  message: string;
}

export interface ZodErrorLike {
  issues: readonly ZodIssueLike[] | ZodIssueLike[];
}

export type ZodSafeParseSuccess<T> = {
  success: true;
  data: T;
};

export type ZodSafeParseError = {
  success: false;
  error: ZodErrorLike;
};

export type ZodSafeParseResult<T> = ZodSafeParseSuccess<T> | ZodSafeParseError;

export interface ZodSchemaLike<T = unknown> {
  safeParse(data: unknown): ZodSafeParseResult<T>;
}

/**
 * Formats Zod validation error issues into a flat `Record<string, string>` dictionary
 * mapping field paths (e.g. "address.postalCode") to their validation failure messages.
 */
export function formatZodErrors(
  errorOrIssues: ZodErrorLike | readonly ZodIssueLike[] | ZodIssueLike[],
): Record<string, string> {
  const issues = 'issues' in errorOrIssues ? errorOrIssues.issues : errorOrIssues;
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const fieldName = Array.from(issue.path).map(String).join('.') || '_root';
    if (!fieldErrors[fieldName]) {
      fieldErrors[fieldName] = issue.message;
    }
  }

  return fieldErrors;
}

/**
 * Validates request payload against a Zod schema.
 * Automatically formats Zod issues and throws a domain `ValidationError` if validation fails.
 * Returns strongly-typed parsed output data.
 */
export function validateBody<T>(
  schema: ZodSchemaLike<T>,
  body: unknown,
  errorMessage = 'Invalid request data',
): T {
  const parseResult = schema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(errorMessage, formatZodErrors(parseResult.error));
  }

  return parseResult.data;
}
