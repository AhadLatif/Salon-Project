import express from "express";
import type { Express } from "express";
import {pinoHttp} from "pino-http";
import { logger } from "@salon/logger";
import { registerRoutes } from "./http/routes/index.js";
import { registerMiddleware } from "./http/middlewares/index.js";

/**
 * @Responsible for:
 * * Creating express()
 * Registering middleware
 * Registering routes
 * Returning the configured app
 * * It does not listen on a port.
 */

export function createApp() : Express {
  // Create the Express application instance.
  const app = express();


  // Log every incoming HTTP request.
  app.use(
    pinoHttp({
      logger,
    }),
  );
 
  app.use(express.json());

  // Register application routes.
  registerRoutes(app);

  //register middlewares
  registerMiddleware(app);

  return app;
}