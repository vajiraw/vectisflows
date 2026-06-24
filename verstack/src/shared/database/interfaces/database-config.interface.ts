/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  maxConnections?: number;
  replication?: {
    read: Array<{
      host: string;
      port: number;
    }>;
  };
}

/**
 * Database initialization options
 */
export interface DatabaseOptions {
  isGlobal?: boolean;
  config?: DatabaseConfig;
}
