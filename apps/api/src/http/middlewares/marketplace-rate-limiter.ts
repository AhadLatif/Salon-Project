import { config } from '@salon/config';
import { TooManyRequestsError } from '@salon/shared';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

export const marketplaceRateLimiter = rateLimit({
  windowMs: config.marketplace.rateLimit.windowMs,
  max: config.marketplace.rateLimit.max,

  // This function runs when someone exceeds the limit
  handler: (_req: Request, _res: Response, next: NextFunction) => {
    // We throw our standard AppError so it goes through our global error handler
    // rather than express-rate-limit's default plain-text response.
    next(new TooManyRequestsError());
  },

  // standardHeaders sends the RateLimit-* headers to the client so they know when to retry
  standardHeaders: true,
  legacyHeaders: false,
});
