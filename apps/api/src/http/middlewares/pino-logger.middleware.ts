import crypto from 'node:crypto';
import { logger } from '@salon/logger';
import type { Request, Response } from 'express';
import { type HttpLogger, pinoHttp } from 'pino-http';

/**
 * HTTP REQUEST LOGGING MIDDLEWARE (Pino-HTTP)
 *
 * Captures request latency, HTTP status codes, error details, and distributed trace IDs.
 *
 * @input Incoming HTTP Request
 * @mutates
 *   - Response Headers: sets `X-Request-ID` (UUID)
 *   - Request Object: sets `req.id` (UUID)
 * @exits Unconditionally calls `next()` to pass execution to subsequent route handlers
 *
 * Architecture Invariants:
 * 1. Distributed Tracing: Forwards existing `x-request-id` header or generates a new UUID v4.
 * 2. Noise Suppression: Silences `/health` polling to keep production log streams uncluttered.
 * 3. Dynamic Log Levels: 2xx/3xx -> INFO, 4xx -> WARN, 5xx -> ERROR.
 * 4. PII Redaction: Automatically masks passwords, refresh tokens, auth headers, and session cookies.
 * 5. Sanitized URLs: Strips raw query strings from log lines to prevent accidental token/PII leakage.
 */

/** Strip query parameters from a URL string to prevent token/PII leakage in logs. */
function stripQuery(url: string | undefined): string {
  return url?.split('?', 1)[0] ?? '';
}

export const httpLoggerMiddleware: HttpLogger<Request, Response> = pinoHttp({
  // Reuse shared pino logger instance from @salon/logger
  logger,

  // 1. Generate or forward X-Request-ID for distributed tracing
  genReqId: (req: Request, res: Response) => {
    const existingId = req.headers['x-request-id'] as string;
    if (existingId) return existingId;

    const id = crypto.randomUUID();
    res.setHeader('X-Request-ID', id);
    return id;
  },

  // 2. Silence Polling Routes (e.g. Health checks)
  autoLogging: {
    ignore: (req: Request) => {
      // Don't clutter terminal/logs with container health-checks
      return req.url === '/health' || req.url === '/api/v1/health';
    },
  },

  // 3. Dynamic Log Levels based on HTTP Response Status
  customLogLevel: (_req: Request, res: Response, err?: Error) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    // 3xx redirects log at info (rule 2 requires an enabled level, never 'silent')
    return 'info';
  },

  // 4. Custom Success/Error Messages (query string stripped to prevent PII/token leaks)
  customSuccessMessage: (req: Request, res: Response) => {
    return `HTTP ${req.method} ${stripQuery(req.url)} -> ${res.statusCode}`;
  },
  customErrorMessage: (req: Request, res: Response, err: Error) => {
    return `HTTP ${req.method} ${stripQuery(req.url)} -> ${res.statusCode} [FAILED: ${err.message}]`;
  },

  // 5. Native Data Redaction (Prevents credential leaks)
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-refresh-token"]',
      'req.body.password',
      'req.body.passwordPlainText',
      'req.body.confirmPassword',
      'req.body.token',
    ],
    censor: '[REDACTED]',
  },

  // 6. Minimal Request Serializers (Keep payload slim, no raw query params)
  serializers: {
    req: (req: Request) => ({
      id: req.id,
      method: req.method,
      url: stripQuery(req.url),
      params: req.params,
      // Omit raw body, headers, and query to prevent noisy terminal prints & PII leaks
    }),
    res: (res: Response) => ({
      statusCode: res.statusCode,
    }),
  },
});
