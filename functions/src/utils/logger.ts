/**
 * 構造化ロギングユーティリティ
 * Cloud Functions 全体で一貫したコンテキスト付きロギングを提供
 */

import * as functions from "firebase-functions";

// ログレベル
export type LogLevel = "debug" | "info" | "warn" | "error";

// ログコンテキストインターフェース
export interface LogContext {
  requestId?: string;
  userId?: string;
  functionName?: string;
  [key: string]: unknown;
}

// 構造化ログエントリ
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
 * 構造化ロギング用ロガークラス
 */
class Logger {
  private context: LogContext = {};
  private static instance: Logger;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * すべてのログにグローバルコンテキストを設定
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * コンテキストをクリア
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * 追加コンテキストを持つ子ロガーを作成
   */
  child(additionalContext: LogContext): ChildLogger {
    return new ChildLogger({ ...this.context, ...additionalContext });
  }

  /**
   * ログエントリをフォーマット
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
   * デバッグレベルログ
   */
  debug(message: string, data?: Record<string, unknown>): void {
    const entry = this.formatEntry("debug", message, data);
    functions.logger.debug(entry);
  }

  /**
   * 情報レベルログ
   */
  info(message: string, data?: Record<string, unknown>): void {
    const entry = this.formatEntry("info", message, data);
    functions.logger.info(entry);
  }

  /**
   * 警告レベルログ
   */
  warn(message: string, data?: Record<string, unknown>, error?: Error): void {
    const entry = this.formatEntry("warn", message, data, error);
    functions.logger.warn(entry);
  }

  /**
   * エラーレベルログ
   */
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    const entry = this.formatEntry("error", message, data, error);
    functions.logger.error(entry);
  }

  /**
   * 関数実行開始をログ出力
   */
  functionStart(functionName: string, data?: Record<string, unknown>): void {
    this.setContext({ functionName });
    this.info(`Function ${functionName} started`, data);
  }

  /**
   * 関数実行終了をログ出力
   */
  functionEnd(functionName: string, durationMs: number, data?: Record<string, unknown>): void {
    this.info(`Function ${functionName} completed`, {
      ...data,
      durationMs,
    });
  }

  /**
   * API リクエストをログ出力
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
   * API レスポンスをログ出力
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
   * セキュリティイベントをログ出力
   */
  security(event: string, data?: Record<string, unknown>): void {
    this.warn(`Security Event: ${event}`, data);
  }

  /**
   * パフォーマンスメトリクスをログ出力
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
 * 継承されたコンテキストを持つ子ロガー
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

// シングルトンインスタンスをエクスポート
export const logger = Logger.getInstance();

// テスト用に Logger クラスをエクスポート
export { Logger, ChildLogger };
