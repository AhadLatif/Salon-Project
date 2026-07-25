import type { Express } from 'express';
import type { Server } from 'node:http';

import { config } from '@salon/config';
import { logger } from '@salon/logger';

/**
 * @Responsible for:
 * Starting the HTTP server
 * Graceful shutdown (later)
 * Returning the server instance
 * It knows how to run Express.
 */

export function startServer(app: Express): Server {

  const server = app.listen(config.server.port, config.server.host, () => {
    
    logger.info(`HTTP server listening at http://${config.server.host}:${config.server.port}`);
  });

  return server;
}



