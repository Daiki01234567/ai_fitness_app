/**
 * ログユーティリティ
 *
 * アプリ全体で使用するログ機能を提供します。
 * 環境に応じてログレベルを切り替え、センシティブ情報を保護します。
 *
 * @see docs/expo/tickets/006-monitoring-logging.md
 */

import { getEnvironment } from "./firebase";

/**
 * ログレベル定義
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * ログレベルの優先度マップ
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * ログエントリの型定義
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Loggerインターフェース
 */
export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
}

/**
 * センシティブなキーのパターン（ログから除外）
 * GDPR/個人情報保護のため、これらのキーは値をマスクする
 */
const SENSITIVE_KEYS = [
  /password/i,
  /token/i,
  /secret/i,
  /email/i,
  /phone/i,
  /address/i,
  /creditcard/i,
  /cvv/i,
  /ssn/i,
  /apikey/i,
  /auth/i,
  /credential/i,
];

/**
 * オブジェクトからセンシティブな情報をマスク
 */
function maskSensitiveData(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data) return undefined;

  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEYS.some((pattern) => pattern.test(key));

    if (isSensitive) {
      masked[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      masked[key] = maskSensitiveData(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * エラーオブジェクトを安全にシリアライズ
 */
function serializeError(error: Error): LogEntry["error"] {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

/**
 * 現在のログレベルを取得
 * - development: DEBUG
 * - staging: INFO
 * - production: WARN
 */
function getCurrentLogLevel(): LogLevel {
  const env = getEnvironment();

  switch (env) {
    case "production":
      return LogLevel.WARN;
    case "staging":
      return LogLevel.INFO;
    default:
      return LogLevel.DEBUG;
  }
}

/**
 * ログを出力すべきかどうかを判定
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getCurrentLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

/**
 * ログエントリをフォーマット
 */
function formatLogEntry(entry: LogEntry): string {
  const { timestamp, level, message, data, error } = entry;
  let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (data && Object.keys(data).length > 0) {
    formatted += ` | data: ${JSON.stringify(data)}`;
  }

  if (error) {
    formatted += ` | error: ${error.name}: ${error.message}`;
    if (error.stack && getCurrentLogLevel() === LogLevel.DEBUG) {
      formatted += `\n${error.stack}`;
    }
  }

  return formatted;
}

/**
 * コンソールにログを出力
 */
function writeLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case LogLevel.DEBUG:
      console.debug(formatted);
      break;
    case LogLevel.INFO:
      console.info(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.ERROR:
      console.error(formatted);
      break;
  }
}

/**
 * ログエントリを作成して出力
 */
function log(
  level: LogLevel,
  message: string,
  error?: Error,
  data?: Record<string, unknown>
): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data: maskSensitiveData(data),
    error: error ? serializeError(error) : undefined,
  };

  writeLog(entry);
}

/**
 * ロガーインスタンス
 *
 * @example
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * // 基本的な使用法
 * logger.debug('処理開始', { userId: '123' });
 * logger.info('ユーザーがログインしました', { method: 'email' });
 * logger.warn('レート制限に近づいています', { remaining: 10 });
 * logger.error('APIリクエストに失敗しました', error, { endpoint: '/api/users' });
 * ```
 */
export const logger: Logger = {
  /**
   * DEBUGレベルのログを出力
   * 開発環境でのみ表示される詳細な情報
   */
  debug(message: string, data?: Record<string, unknown>): void {
    log(LogLevel.DEBUG, message, undefined, data);
  },

  /**
   * INFOレベルのログを出力
   * 通常の操作情報
   */
  info(message: string, data?: Record<string, unknown>): void {
    log(LogLevel.INFO, message, undefined, data);
  },

  /**
   * WARNレベルのログを出力
   * 注意が必要だが処理は継続可能な状況
   */
  warn(message: string, data?: Record<string, unknown>): void {
    log(LogLevel.WARN, message, undefined, data);
  },

  /**
   * ERRORレベルのログを出力
   * エラーが発生し、対処が必要な状況
   */
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    log(LogLevel.ERROR, message, error, data);
  },
};

/**
 * スコープ付きロガーを作成
 * 特定のモジュールやコンポーネント用のロガー
 *
 * @example
 * ```typescript
 * const authLogger = createScopedLogger('Auth');
 * authLogger.info('ログイン処理開始'); // [Auth] ログイン処理開始
 * ```
 */
export function createScopedLogger(scope: string): Logger {
  const prefix = `[${scope}]`;

  return {
    debug(message: string, data?: Record<string, unknown>): void {
      logger.debug(`${prefix} ${message}`, data);
    },
    info(message: string, data?: Record<string, unknown>): void {
      logger.info(`${prefix} ${message}`, data);
    },
    warn(message: string, data?: Record<string, unknown>): void {
      logger.warn(`${prefix} ${message}`, data);
    },
    error(message: string, error?: Error, data?: Record<string, unknown>): void {
      logger.error(`${prefix} ${message}`, error, data);
    },
  };
}

export default logger;
