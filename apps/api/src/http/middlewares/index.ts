import type { Express } from 'express';

import { errorHandler } from './error-handler.js';
import { notFoundHandler } from './not-found.js';
export function registerMiddleware(app:Express): void{

    app.use(notFoundHandler);
    app.use(errorHandler);

}