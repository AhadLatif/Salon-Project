import { logger } from "@salon/logger";
import type { Server } from "node:http";
import type { Socket } from "node:net";

export function registerShutdownHandlers(server: Server): void {
  const activeSockets = new Set<Socket>();
  let isShuttingDown = false;

  server.on("connection", (socket: Socket) => {
    activeSockets.add(socket);

    const removeSocket = (): void => {
      activeSockets.delete(socket);
    };

    socket.once("close", removeSocket);
    
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "Shutdown signal received.");

    // Stop accepting new connections.
    server.close((error) => {
      if (error) {
        logger.error(error, "Failed to gracefully shut down HTTP server.");
        process.exit(1);
      }

      logger.info("HTTP server closed.");
      process.exit(0);
    });


    if (typeof server.closeIdleConnections === "function") {
      server.closeIdleConnections();
    }

   
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}



