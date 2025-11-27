/**
 * Structured Logging Utility
 * Provides consistent logging across Cloud Functions with context
 */

import * as functions from "firebase-functions";

// Log levels
export type LogLevel = "debug" | "info" | "warn" | "error";

// Log context interface
export interface LogContext {
  requestId?: string;
  userId?: string;
  functionName?: string;
  [key: string]: unknown;
}

// Structured log entry
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Logger class for structured logging
 */
class Logger {
  private context: LogContext = {};
  private static instance: Logger;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set global context for all logs
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): ChildLogger {
    return new ChildLogger({ ...this.context, ...additionalContext });
  }

  /**
   * Format log entry
   */
  private formatEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: Object.keys(this.context).length > 0 ? this.context : undefined,
      data,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as NodeJS.ErrnoException).code,
      };
    }

    return entry;
  }

  /**
   * Debug level log
   */
  debug(message: string, data?: Record<string, unknown>): void {
    const entry = this.formatEntry("debug", message, data);
    functions.logger.debug(entry);
  }

  /**
   * Info level log
   */
  info(message: string, data?: Record<string, unknown>): void {
    const entry = this.formatEntry("info", message, data);
    functions.logger.info(entry);
  }

  /**
   * Warning level log
   */
  warn(message: string, data?: Record<string, unknown>, error?: Error): void {
    const entry = this.formatEntry("warn", message, data, error);
    functions.logger.warn(entry);
  }

  /**
   * Error level log
   */
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    const entry = this.formatEntry("error", message, data, error);
    functions.logger.error(entry);
  }

  /**
   * Log function execution start
   */
  functionStart(functionName: string, data?: Record<string, unknown>): void {
    this.setContext({ functionName });
    this.info(`Function ${functionName} started`, data);
  }

  /**
   * Log function execution end
   */
  functionEnd(functionName: string, durationMs: number, data?: Record<string, unknown>): void {
    this.info(`Function ${functionName} completed`, {
      ...data,
      durationMs,
    });
  }

  /**
   * Log API request
   */
  apiRequest(
    method: string,
    endpoint: string,
    userId?: string,
    data?: Record<string, unknown>,
  ): void {
    this.info("API Request", {
      method,
      endpoint,
      userId,
      ...data,
    });
  }

  /**
   * Log API response
   */
  apiResponse(
    statusCode: number,
    durationMs: number,
    data?: Record<string, unknown>,
  ): void {
    this.info("API Response", {
      statusCode,
      durationMs,
      ...data,
    });
  }

  /**
   * Log security event
   */
  security(event: string, data?: Record<string, unknown>): void {
    this.warn(`Security Event: ${event}`, data);
  }

  /**
   * Log performance metric
   */
  performance(metric: string, value: number, unit: string, data?: Record<string, unknown>): void {
    this.info("Performance Metric", {
      metric,
      value,
      unit,
      ...data,
    });
  }
}

/**
 * Child logger with inherited context
 */
class ChildLogger {
  private context: LogContext;

  constructor(context: LogContext) {
    this.context = context;
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.context,
      data,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as NodeJS.ErrnoException).code,
      };
    }

    return entry;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    const entry = this.formatEntry("debug", message, data);
    functions.logger.debug(entry);
  }

  info(message: string, data?: Record<string, unknown>): void {
    const entry = this.formatEntry("info", message, data);
    functions.logger.info(entry);
  }

  warn(message: string, data?: Record<string, unknown>, error?: Error): void {
    const entry = this.formatEntry("warn", message, data, error);
    functions.logger.warn(entry);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    const entry = this.formatEntry("error", message, data, error);
    functions.logger.error(entry);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export Logger class for testing
export { Logger, ChildLogger };
