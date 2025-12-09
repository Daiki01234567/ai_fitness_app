/**
 * エラークラス定義
 *
 * アプリ全体で使用するカスタムエラークラスを定義します。
 * 各エラーはエラーコード、ユーザー向けメッセージ、元のエラーを保持します。
 *
 * @see CLAUDE.md - エラーハンドリング要件
 */

/**
 * エラーコード列挙型
 *
 * Firebase Authのエラーコードに準拠しつつ、
 * アプリ固有のエラーコードも定義します。
 */
export enum ErrorCode {
  // Auth errors
  AUTH_INVALID_EMAIL = "auth/invalid-email",
  AUTH_WRONG_PASSWORD = "auth/wrong-password",
  AUTH_USER_NOT_FOUND = "auth/user-not-found",
  AUTH_EMAIL_IN_USE = "auth/email-already-in-use",
  AUTH_WEAK_PASSWORD = "auth/weak-password",
  AUTH_USER_DISABLED = "auth/user-disabled",
  AUTH_TOO_MANY_REQUESTS = "auth/too-many-requests",
  AUTH_OPERATION_NOT_ALLOWED = "auth/operation-not-allowed",
  AUTH_REQUIRES_RECENT_LOGIN = "auth/requires-recent-login",
  AUTH_INVALID_CREDENTIAL = "auth/invalid-credential",
  AUTH_NETWORK_REQUEST_FAILED = "auth/network-request-failed",

  // Network errors
  NETWORK_OFFLINE = "network/offline",
  NETWORK_TIMEOUT = "network/timeout",
  NETWORK_SERVER_ERROR = "network/server-error",
  NETWORK_REQUEST_FAILED = "network/request-failed",

  // Validation errors
  VALIDATION_REQUIRED = "validation/required",
  VALIDATION_FORMAT = "validation/format",
  VALIDATION_MIN_LENGTH = "validation/min-length",
  VALIDATION_MAX_LENGTH = "validation/max-length",
  VALIDATION_PATTERN = "validation/pattern",
  VALIDATION_EMAIL = "validation/email",
  VALIDATION_PASSWORD = "validation/password",

  // Firestore errors
  FIRESTORE_PERMISSION_DENIED = "firestore/permission-denied",
  FIRESTORE_NOT_FOUND = "firestore/not-found",
  FIRESTORE_ALREADY_EXISTS = "firestore/already-exists",
  FIRESTORE_RESOURCE_EXHAUSTED = "firestore/resource-exhausted",
  FIRESTORE_FAILED_PRECONDITION = "firestore/failed-precondition",
  FIRESTORE_UNAVAILABLE = "firestore/unavailable",

  // Storage errors
  STORAGE_OBJECT_NOT_FOUND = "storage/object-not-found",
  STORAGE_UNAUTHORIZED = "storage/unauthorized",
  STORAGE_QUOTA_EXCEEDED = "storage/quota-exceeded",

  // Generic errors
  UNKNOWN = "unknown",
  CANCELLED = "cancelled",
}

/**
 * エラーコードに対応するユーザー向けメッセージ（日本語）
 */
export const errorMessages: Record<string, string> = {
  // Auth errors
  [ErrorCode.AUTH_INVALID_EMAIL]: "メールアドレスの形式が正しくありません",
  [ErrorCode.AUTH_WRONG_PASSWORD]: "パスワードが正しくありません",
  [ErrorCode.AUTH_USER_NOT_FOUND]: "ユーザーが見つかりません",
  [ErrorCode.AUTH_EMAIL_IN_USE]: "このメールアドレスは既に使用されています",
  [ErrorCode.AUTH_WEAK_PASSWORD]: "パスワードが脆弱です。より強力なパスワードを設定してください",
  [ErrorCode.AUTH_USER_DISABLED]: "このアカウントは無効化されています",
  [ErrorCode.AUTH_TOO_MANY_REQUESTS]:
    "リクエストが多すぎます。しばらく時間をおいてから再度お試しください",
  [ErrorCode.AUTH_OPERATION_NOT_ALLOWED]: "この操作は許可されていません",
  [ErrorCode.AUTH_REQUIRES_RECENT_LOGIN]:
    "この操作には再度ログインが必要です",
  [ErrorCode.AUTH_INVALID_CREDENTIAL]:
    "認証情報が無効です。再度ログインしてください",
  [ErrorCode.AUTH_NETWORK_REQUEST_FAILED]:
    "ネットワークエラーが発生しました。インターネット接続を確認してください",

  // Network errors
  [ErrorCode.NETWORK_OFFLINE]: "インターネット接続を確認してください",
  [ErrorCode.NETWORK_TIMEOUT]: "接続がタイムアウトしました。再度お試しください",
  [ErrorCode.NETWORK_SERVER_ERROR]:
    "サーバーエラーが発生しました。しばらく時間をおいてから再度お試しください",
  [ErrorCode.NETWORK_REQUEST_FAILED]: "リクエストに失敗しました",

  // Validation errors
  [ErrorCode.VALIDATION_REQUIRED]: "必須項目を入力してください",
  [ErrorCode.VALIDATION_FORMAT]: "入力形式が正しくありません",
  [ErrorCode.VALIDATION_MIN_LENGTH]: "入力が短すぎます",
  [ErrorCode.VALIDATION_MAX_LENGTH]: "入力が長すぎます",
  [ErrorCode.VALIDATION_PATTERN]: "入力形式が正しくありません",
  [ErrorCode.VALIDATION_EMAIL]: "有効なメールアドレスを入力してください",
  [ErrorCode.VALIDATION_PASSWORD]:
    "パスワードは8文字以上で、大文字・小文字・数字を含めてください",

  // Firestore errors
  [ErrorCode.FIRESTORE_PERMISSION_DENIED]: "アクセス権限がありません",
  [ErrorCode.FIRESTORE_NOT_FOUND]: "データが見つかりません",
  [ErrorCode.FIRESTORE_ALREADY_EXISTS]: "データは既に存在します",
  [ErrorCode.FIRESTORE_RESOURCE_EXHAUSTED]:
    "リソースが不足しています。しばらく時間をおいてから再度お試しください",
  [ErrorCode.FIRESTORE_FAILED_PRECONDITION]:
    "操作を実行できる状態ではありません",
  [ErrorCode.FIRESTORE_UNAVAILABLE]:
    "サービスが一時的に利用できません。しばらく時間をおいてから再度お試しください",

  // Storage errors
  [ErrorCode.STORAGE_OBJECT_NOT_FOUND]: "ファイルが見つかりません",
  [ErrorCode.STORAGE_UNAUTHORIZED]: "ファイルへのアクセス権限がありません",
  [ErrorCode.STORAGE_QUOTA_EXCEEDED]:
    "ストレージ容量を超過しました。不要なファイルを削除してください",

  // Generic errors
  [ErrorCode.UNKNOWN]: "予期しないエラーが発生しました",
  [ErrorCode.CANCELLED]: "操作がキャンセルされました",
};

/**
 * エラーコードからユーザー向けメッセージを取得
 *
 * @param code - エラーコード
 * @returns ユーザー向けメッセージ
 */
export function getUserMessage(code: string): string {
  return errorMessages[code] ?? errorMessages[ErrorCode.UNKNOWN]!;
}

/**
 * アプリケーション基底エラークラス
 *
 * 全てのカスタムエラーの基底クラスです。
 * エラーコード、ユーザー向けメッセージ、元のエラーを保持します。
 */
export class AppError extends Error {
  /** エラーコード */
  public readonly code: string;
  /** ユーザー向けメッセージ（日本語） */
  public readonly userMessage: string;
  /** 元のエラー（存在する場合） */
  public readonly originalError?: Error;
  /** エラー発生時刻 */
  public readonly timestamp: Date;

  constructor(
    code: string = ErrorCode.UNKNOWN,
    message?: string,
    originalError?: Error
  ) {
    const userMessage = getUserMessage(code);
    super(message ?? userMessage);

    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
    this.originalError = originalError;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * エラー情報をJSON形式で取得（ログ出力用）
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
          }
        : undefined,
    };
  }
}

/**
 * 認証エラークラス
 *
 * Firebase Authに関連するエラーを表します。
 */
export class AuthError extends AppError {
  constructor(code: string = ErrorCode.UNKNOWN, originalError?: Error) {
    super(code, undefined, originalError);
    this.name = "AuthError";
  }
}

/**
 * ネットワークエラークラス
 *
 * ネットワーク関連のエラーを表します。
 */
export class NetworkError extends AppError {
  /** HTTPステータスコード（存在する場合） */
  public readonly statusCode?: number;

  constructor(
    code: string = ErrorCode.NETWORK_REQUEST_FAILED,
    statusCode?: number,
    originalError?: Error
  ) {
    super(code, undefined, originalError);
    this.name = "NetworkError";
    this.statusCode = statusCode;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
    };
  }
}

/**
 * バリデーションエラークラス
 *
 * フォーム入力等のバリデーションエラーを表します。
 */
export class ValidationError extends AppError {
  /** バリデーションエラーが発生したフィールド名 */
  public readonly field?: string;

  constructor(
    code: string = ErrorCode.VALIDATION_FORMAT,
    field?: string,
    customMessage?: string
  ) {
    super(code, customMessage);
    this.name = "ValidationError";
    this.field = field;
    // Custom message overrides the default user message
    if (customMessage) {
      (this as { userMessage: string }).userMessage = customMessage;
    }
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      field: this.field,
    };
  }
}

/**
 * Firestoreエラークラス
 *
 * Firestoreデータベース関連のエラーを表します。
 */
export class FirestoreError extends AppError {
  /** 操作対象のコレクションパス */
  public readonly path?: string;

  constructor(
    code: string = ErrorCode.UNKNOWN,
    path?: string,
    originalError?: Error
  ) {
    super(code, undefined, originalError);
    this.name = "FirestoreError";
    this.path = path;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      path: this.path,
    };
  }
}

/**
 * Storageエラークラス
 *
 * Firebase Storage関連のエラーを表します。
 */
export class StorageError extends AppError {
  /** 操作対象のファイルパス */
  public readonly filePath?: string;

  constructor(
    code: string = ErrorCode.UNKNOWN,
    filePath?: string,
    originalError?: Error
  ) {
    super(code, undefined, originalError);
    this.name = "StorageError";
    this.filePath = filePath;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      filePath: this.filePath,
    };
  }
}

/**
 * 型ガード: AppErrorかどうかを判定
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 型ガード: AuthErrorかどうかを判定
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * 型ガード: NetworkErrorかどうかを判定
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * 型ガード: ValidationErrorかどうかを判定
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * 型ガード: FirestoreErrorかどうかを判定
 */
export function isFirestoreError(error: unknown): error is FirestoreError {
  return error instanceof FirestoreError;
}

/**
 * 型ガード: StorageErrorかどうかを判定
 */
export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}
