import {
  AppError,
  ConflictError,
  ForbiddenError,
  ResourceNotFoundError,
  TenantIsolationError,
  UnauthorizedError,
  ValidationError,
} from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';

/**
 * GLOBAL TERMINAL ERROR HANDLER
 *
 * Express identifies error middlewares by their 4-parameter signature: `(err, req, res, next)`.
 * Whenever any upstream middleware or controller throws an error or invokes `next(error)`,
 * Express skips all remaining 3-parameter middlewares and routes execution directly here.
 *
 * Operational Mapping:
 * - `ValidationError`         -> 400 Bad Request (includes structured `details` map)
 * - `UnauthorizedError`        -> 401 Unauthorized (missing or invalid JWT)
 * - `ForbiddenError`           -> 403 Forbidden (cross-tenant IDOR / insufficient permissions)
 * - `ResourceNotFoundError`    -> 404 Not Found (entity does not exist)
 * - `TenantIsolationError`     -> 404 Not Found (obscures cross-tenant resource existence)
 * - `ConflictError`            -> 409 Conflict (uniqueness violation, concurrency collisions)
 * - Uncaught standard `Error`  -> 500 Internal Server Error (logged securely, details hidden)
 *
 * Response Envelope:
 * Always returns standard JSON envelope: `{ success: false, error: { code, message, details }, meta: {} }`
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // The response has already started. Only the default handler can recover.
  if (res.headersSent) {
    next(err);
    return;
  }

  // 1. If it's one of our known Operational AppErrors, handle it gracefully
  if (err instanceof AppError) {
    let statusCode = 500;

    if (err instanceof ValidationError) statusCode = 400;
    else if (err instanceof UnauthorizedError) statusCode = 401;
    else if (err instanceof ForbiddenError) statusCode = 403;
    // Map TenantIsolation to 404 to obscure the existence of other tenants' data
    else if (err instanceof ResourceNotFoundError || err instanceof TenantIsolationError)
      statusCode = 404;
    else if (err instanceof ConflictError) statusCode = 409;

    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      },
      meta: {
        // TODO :In the future, we will attach request IDs here for tracing
      },
    });
    return;
  }

  // 2. If it's an UNEXPECTED error (like a syntax error or DB crash)
  console.error('[CRITICAL UNHANDLED ERROR]:', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      details: {},
    },
    meta: {},
  });
}
