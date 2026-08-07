import crypto from 'node:crypto';
import { logger } from '@salon/logger';
import type { Request, Response } from 'express';
import { type HttpLogger, pinoHttp } from 'pino-http';

/**
 * @remarks A professional request logger must adhere to 5 rules:
 *
 * 1. Silence Polling Noise: Never log routine health-check calls (GET /health).
 * 2. Dynamic Log Levels: 2xx/3xx requests log as info (or debug), 4xx as warn, and 5xx as error.
 * 3. Strict Redaction: Automatically strip passwords, authorization tokens, and credit card numbers from headers and bodies.
 * 4. Request Correlation ID: Assign a unique X-Request-ID to every HTTP request so you can trace a log entry directly to a specific user call.
 * 5. No Body Bloat: Never print raw request bodies unless explicitly necessary for debugging.
 */

/** Strip the query string from a URL to avoid leaking tokens/PII embedded in query params. */
function stripQuery(url: string | undefined): string {
  return url?.split('?', 1)[0] ?? '';
}

export const httpLoggerMiddleware: HttpLogger<Request, Response> = pinoHttp({
  // Reuse our existing pino instance from @salon/logger
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
