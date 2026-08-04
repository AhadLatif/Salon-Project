import type { NextFunction, Request, Response } from 'express';

export function notFoundHandler(request: Request, response: Response, _next: NextFunction): void {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route '${request.originalUrl}' was not found.`,
    },
  });
}
