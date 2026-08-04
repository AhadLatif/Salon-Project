import { config } from '@salon/config';
import pino, { type LoggerOptions } from 'pino';

const options: LoggerOptions = {
  level: config.logging.level,

  base: {
    app: config.app.name,
    environment: config.app.environment,
  },
};

if (config.app.environment === 'development') {
  options.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(options);

/**
 *  If everyone uses the global logger, developers must remember to add:
 *
 *  { module: "Module-Name" }
 *
 *  thats why this function is created to create a child logger with module name
 */
export function createLogger(moduleName: string): pino.Logger {
  return logger.child({ module: moduleName });
}
