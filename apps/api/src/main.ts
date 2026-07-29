import './boostrap/env.js';

import { logger } from '@salon/logger';
import type { Express } from 'express';
import { createApp } from './app.js';
import { registerShutdownHandlers } from './boostrap/shutdown.js';
import { startServer } from './server.js';

/**
 * app.ts is testable without opening a socket.
 * server.ts owns networking.
 * main.ts owns process startup.
 *
 */

/**
 * The application's entry point.
 *
 * @Responsible for:
 * Loading configuration
 * Creating the app
 * Starting the server
 * Logging startup success
 * Handling fatal startup errors
 */

export function bootstrapApplication(): void {
  try {
    // Build the application.
    const app: Express = createApp();

    // Start listening for incoming requests.
    const server = startServer(app);

    server.once('error', (error) => {
      logger.fatal(error, 'Application failed to start');
      process.exit(1);
    });

    registerShutdownHandlers(server);
  } catch (error) {
    logger.fatal(error, 'Application failed to start');

    process.exit(1);
  }
}

bootstrapApplication();
