/**
 * Database module constants
 */

export const DATABASE_MODULE_OPTIONS = 'DATABASE_MODULE_OPTIONS';

/**
 * Default connection pool configuration
 */
export const DEFAULT_CONNECTION_POOL_CONFIG = {
  minConnections: 2,
  maxConnections: 10,
  connectionTimeoutMs: 5000,
  idleTimeoutMs: 30000,
  validationIntervalMs: 60000,
};

/**
 * Default database configuration
 */
export const DEFAULT_DATABASE_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'verstack',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'akinsa',
  ssl: process.env.DB_SSL === 'true',
  logLevel: (process.env.DATABASE_LOG_LEVEL as any) || 'info',
  connectionTimeoutMs: parseInt(
    process.env.DB_CONNECTION_TIMEOUT || '5000',
    10,
  ),
  idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
};

/**
 * Database service injection token
 */
export const PRISMA_SERVICE = 'PRISMA_SERVICE';
export const CONNECTION_POOL_SERVICE = 'CONNECTION_POOL_SERVICE';
