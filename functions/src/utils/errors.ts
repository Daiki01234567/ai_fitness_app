/**
 * カスタムエラークラスとエラーハンドリングユーティリティ
 * Cloud Functions 全体で一貫したエラー処理を提供
 */

import { HttpsError, FunctionsErrorCode } from "firebase-functions/v2/https";

import { AppErrorCode, AppErrorCodes, ErrorCodes, ErrorDetails } from "../types/errors";

import { logger } from "./logger";

/**
 * 基底アプリケーションエラークラス
 */
export class AppError extends Error {
  public readonly code: FunctionsErrorCode;
  public readonly appCode?: AppErrorCode;
  public readonly details?: ErrorDetails;
  public readonly httpStatus: number;
  public readonly retryable: boolean;

  constructor(
    code: FunctionsErrorCode,
    message: string,
    options?: {
      appCode?: AppErrorCode;
      details?: ErrorDetails;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.appCode = options?.appCode;
    this.details = options?.details;

    // エラー設定を検索
    const errorConfig = Object.values(ErrorCodes).find((e) => e.code === code);
    this.httpStatus = errorConfig?.httpStatus ?? 500;
    this.retryable = errorConfig?.retryable ?? false;

    if (options?.cause) {
      this.cause = options.cause;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Firebase Functions 用の HttpsError に変換
   */
  toHttpsError(): HttpsError {
    return new HttpsError(this.code, this.message, this.details);
  }
}

/**
 * 無効な入力データ用のバリデーションエラー
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super("invalid-argument", message, {
      appCode: AppErrorCodes.VALIDATION_FAILED,
      details,
    });
    this.name = "ValidationError";
  }

  static field(field: string, message: string, constraint?: string): ValidationError {
    return new ValidationError(message, { field, constraint });
  }

  static required(field: string): ValidationError {
    return new ValidationError(`${field}は必須です`, {
      field,
      constraint: "required",
    });
  }

  static invalidType(field: string, expectedType: string): ValidationError {
    return new ValidationError(`${field}の型が不正です。${expectedType}が必要です`, {
      field,
      constraint: `type:${expectedType}`,
    });
  }

  static outOfRange(field: string, min?: number, max?: number): ValidationError {
    let message = `${field}の値が範囲外です`;
    if (min !== undefined && max !== undefined) {
      message = `${field}は${min}から${max}の範囲で入力してください`;
    } else if (min !== undefined) {
      message = `${field}は${min}以上で入力してください`;
    } else if (max !== undefined) {
      message = `${field}は${max}以下で入力してください`;
    }
    return new ValidationError(message, {
      field,
      constraint: `range:${min ?? ""}-${max ?? ""}`,
    });
  }
}

/**
 * 未認証リクエスト用の認証エラー
 */
export class AuthenticationError extends AppError {
  constructor(message = "認証が必要です") {
    super("unauthenticated", message, {
      appCode: AppErrorCodes.AUTH_TOKEN_INVALID,
    });
    this.name = "AuthenticationError";
  }

  static tokenExpired(): AuthenticationError {
    const error = new AuthenticationError("認証トークンの有効期限が切れています");
    (error as { appCode: AppErrorCode }).appCode = AppErrorCodes.AUTH_TOKEN_EXPIRED;
    return error;
  }

  static sessionRevoked(): AuthenticationError {
    const error = new AuthenticationError("セッションが無効化されています。再ログインしてください");
    (error as { appCode: AppErrorCode }).appCode = AppErrorCodes.AUTH_SESSION_REVOKED;
    return error;
  }
}

/**
 * 禁止されたアクセス用の認可エラー
 */
export class AuthorizationError extends AppError {
  constructor(message = "この操作を行う権限がありません") {
    super("permission-denied", message);
    this.name = "AuthorizationError";
  }

  static deletionScheduled(): AuthorizationError {
    return new AuthorizationError(
      "アカウント削除が予定されているため、データを変更できません。" +
      "削除をキャンセルする場合はサポートにお問い合わせください。",
    );
  }

  static consentRequired(): AuthorizationError {
    const error = new AuthorizationError("利用規約への同意が必要です");
    (error as { appCode: AppErrorCode }).appCode = AppErrorCodes.USER_CONSENT_REQUIRED;
    return error;
  }

  static subscriptionRequired(): AuthorizationError {
    const error = new AuthorizationError("この機能を利用するにはプレミアムプランが必要です");
    (error as { appCode: AppErrorCode }).appCode = AppErrorCodes.SUBSCRIPTION_REQUIRED;
    return error;
  }
}

/**
 * 見つからないリソース用の NotFound エラー
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource}(${id})が見つかりません` : `${resource}が見つかりません`;
    super("not-found", message);
    this.name = "NotFoundError";
  }

  static user(userId?: string): NotFoundError {
    const error = new NotFoundError("ユーザー", userId);
    (error as { appCode: AppErrorCode }).appCode = AppErrorCodes.USER_NOT_FOUND;
    return error;
  }

  static session(sessionId?: string): NotFoundError {
    const error = new NotFoundError("セッション", sessionId);
    (error as { appCode: AppErrorCode }).appCode = AppErrorCodes.SESSION_NOT_FOUND;
    return error;
  }
}

/**
 * レート制限エラー
 */
export class RateLimitError extends AppError {
  constructor(message = "リクエストが多すぎます。しばらく待ってから再度お試しください") {
    super("resource-exhausted", message, {
      appCode: AppErrorCodes.RATE_LIMIT_EXCEEDED,
    });
    this.name = "RateLimitError";
  }
}

/**
 * 外部サービスエラー
 */
export class ExternalServiceError extends AppError {
  public readonly serviceName: string;

  constructor(serviceName: string, message: string, cause?: Error) {
    super("unavailable", message, { cause });
    this.name = "ExternalServiceError";
    this.serviceName = serviceName;
  }

  static bigQuery(message: string, cause?: Error): ExternalServiceError {
    const error = new ExternalServiceError("BigQuery", message, cause);
    (error as { appCode: AppErrorCode }).appCode = AppErrorCodes.BIGQUERY_SYNC_FAILED;
    return error;
  }

  static revenueCat(message: string, cause?: Error): ExternalServiceError {
    const error = new ExternalServiceError("RevenueCat", message, cause);
    (error as { appCode: AppErrorCode }).appCode = AppErrorCodes.REVENUECAT_ERROR;
    return error;
  }
}

/**
 * Cloud Functions 用のグローバルエラーハンドラー
 */
export function handleError(
  error: unknown,
  context?: { userId?: string; requestId?: string },
): never {
  // エラーをログ出力
  if (error instanceof AppError) {
    logger.error(`AppError: ${error.message}`, error, {
      code: error.code,
      appCode: error.appCode,
      details: error.details,
      userId: context?.userId,
      requestId: context?.requestId,
    });
    throw error.toHttpsError();
  }

  if (error instanceof HttpsError) {
    logger.error(`HttpsError: ${error.message}`, error, {
      code: error.code,
      userId: context?.userId,
      requestId: context?.requestId,
    });
    throw error;
  }

  if (error instanceof Error) {
    logger.error(`Unexpected error: ${error.message}`, error, {
      userId: context?.userId,
      requestId: context?.requestId,
    });
    throw new HttpsError("internal", "予期しないエラーが発生しました");
  }

  // 不明なエラータイプ
  logger.error("Unknown error type", undefined, {
    error: String(error),
    userId: context?.userId,
    requestId: context?.requestId,
  });
  throw new HttpsError("internal", "予期しないエラーが発生しました");
}

/**
 * エラーハンドリングで async 関数をラップ
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context?: { userId?: string; requestId?: string },
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
    }
  };
}
