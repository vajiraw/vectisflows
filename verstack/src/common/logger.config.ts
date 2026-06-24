import * as winston from 'winston';
import * as path from 'path';

/**
 * Winston logger configuration for NestJS application
 * Logs all console output (error, info, warn) to verstack_sys.log in the root directory
 */
export const loggerConfig: winston.LoggerOptions = {
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      ({ level, message, timestamp, context, stack }) =>
        `${timestamp} [${context || 'NestJS'}] ${level.toUpperCase()}: ${message}${
          stack ? '\n' + stack : ''
        }`,
    ),
  ),
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'verstack_sys.log'),
      level: 'debug',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, context, stack }) =>
            `${timestamp} [${context || 'NestJS'}] ${level.toUpperCase()}: ${message}${
              stack ? '\n' + stack : ''
            }`,
        ),
      ),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'verstack_sys.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'verstack_sys.log'),
    }),
  ],
};
