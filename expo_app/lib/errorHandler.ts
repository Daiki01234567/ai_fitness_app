/**
 * エラーハンドラー
 *
 * アプリ全体で使用するエラーハンドリング機能を提供します。
 * Firebase Auth、Firestore、ネットワークエラーを統一的に処理し、
 * 適切なカスタムエラーに変換します。
 *
 * @see CLAUDE.md - エラーハンドリング要件
 */

import {
  AppError,
  AuthError,
  NetworkError,
  ValidationError,
  FirestoreError,
  StorageError,
  ErrorCode,
  getUserMessage,
  isAppError,
} from "./errors";

/**
 * エラーハンドラーの設定オプション
 */
export interface ErrorHandlerOptions {
  /** エラーをコンソールに出力するか */
  logToConsole?: boolean;
  /** Crashlyticsにエラーを送信するか（将来実装） */
  reportToCrashlytics?: boolean;
  /** 開発モードかどうか */
  isDevelopment?: boolean;
}

/**
 * デフォルトのエラーハンドラー設定
 */
const defaultOptions: Required<ErrorHandlerOptions> = {
  logToConsole: __DEV__,
  reportToCrashlytics: !__DEV__,
  isDevelopment: __DEV__,
};

/**
 * 現在の設定
 */
let currentOptions: Required<ErrorHandlerOptions> = { ...defaultOptions };

/**
 * エラーハンドラーの設定を更新
 *
 * @param options - 新しい設定オプション
 */
export function configureErrorHandler(options: ErrorHandlerOptions): void {
  currentOptions = { ...currentOptions, ...options };
}

/**
 * Firebase Authエラーコードをアプリのエラーコードに変換
 */
function mapFirebaseAuthErrorCode(firebaseCode: string): string {
  const mapping: Record<string, string> = {
    "auth/invalid-email": ErrorCode.AUTH_INVALID_EMAIL,
    "auth/wrong-password": ErrorCode.AUTH_WRONG_PASSWORD,
    "auth/user-not-found": ErrorCode.AUTH_USER_NOT_FOUND,
    "auth/email-already-in-use": ErrorCode.AUTH_EMAIL_IN_USE,
    "auth/weak-password": ErrorCode.AUTH_WEAK_PASSWORD,
    "auth/user-disabled": ErrorCode.AUTH_USER_DISABLED,
    "auth/too-many-requests": ErrorCode.AUTH_TOO_MANY_REQUESTS,
    "auth/operation-not-allowed": ErrorCode.AUTH_OPERATION_NOT_ALLOWED,
    "auth/requires-recent-login": ErrorCode.AUTH_REQUIRES_RECENT_LOGIN,
    "auth/invalid-credential": ErrorCode.AUTH_INVALID_CREDENTIAL,
    "auth/network-request-failed": ErrorCode.AUTH_NETWORK_REQUEST_FAILED,
  };
  return mapping[firebaseCode] ?? ErrorCode.UNKNOWN;
}

/**
 * Firestoreエラーコードをアプリのエラーコードに変換
 */
function mapFirestoreErrorCode(firestoreCode: string): string {
  const mapping: Record<string, string> = {
    "permission-denied": ErrorCode.FIRESTORE_PERMISSION_DENIED,
    "not-found": ErrorCode.FIRESTORE_NOT_FOUND,
    "already-exists": ErrorCode.FIRESTORE_ALREADY_EXISTS,
    "resource-exhausted": ErrorCode.FIRESTORE_RESOURCE_EXHAUSTED,
    "failed-precondition": ErrorCode.FIRESTORE_FAILED_PRECONDITION,
    unavailable: ErrorCode.FIRESTORE_UNAVAILABLE,
  };
  return mapping[firestoreCode] ?? ErrorCode.UNKNOWN;
}

/**
 * Storageエラーコードをアプリのエラーコードに変換
 */
function mapStorageErrorCode(storageCode: string): string {
  const mapping: Record<string, string> = {
    "object-not-found": ErrorCode.STORAGE_OBJECT_NOT_FOUND,
    unauthorized: ErrorCode.STORAGE_UNAUTHORIZED,
    "quota-exceeded": ErrorCode.STORAGE_QUOTA_EXCEEDED,
  };
  return mapping[storageCode] ?? ErrorCode.UNKNOWN;
}

/**
 * エラーの種類を判定して分類
 */
interface FirebaseError extends Error {
  code?: string;
}

/**
 * Firebase Authエラーかどうかを判定
 */
function isFirebaseAuthError(error: unknown): error is FirebaseError {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as FirebaseError).code === "string" &&
    (error as FirebaseError).code!.startsWith("auth/")
  );
}

/**
 * Firestoreエラーかどうかを判定
 */
function isFirestoreNativeError(error: unknown): error is FirebaseError {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as FirebaseError).code === "string" &&
    // Firestore error codes don't have a prefix in some SDKs
    [
      "permission-denied",
      "not-found",
      "already-exists",
      "resource-exhausted",
      "failed-precondition",
      "unavailable",
    ].includes((error as FirebaseError).code!)
  );
}

/**
 * Storageエラーかどうかを判定
 */
function isStorageNativeError(error: unknown): error is FirebaseError {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as FirebaseError).code === "string" &&
    (error as FirebaseError).code!.startsWith("storage/")
  );
}

/**
 * ネットワークエラーかどうかを判定
 */
function isNetworkNativeError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === "Network request failed") {
    return true;
  }
  if (
    error !== null &&
    typeof error === "object" &&
    "name" in error &&
    (error as Error).name === "AbortError"
  ) {
    return true;
  }
  return false;
}

/**
 * 未知のエラーをAppErrorに変換
 *
 * Firebase Auth、Firestore、ネットワークエラーを自動的に
 * 適切なカスタムエラークラスに変換します。
 *
 * @param error - 元のエラー
 * @returns 変換されたAppError
 */
export function normalizeError(error: unknown): AppError {
  // Already an AppError, return as-is
  if (isAppError(error)) {
    return error;
  }

  // Firebase Auth error
  if (isFirebaseAuthError(error)) {
    const code = mapFirebaseAuthErrorCode(error.code!);
    return new AuthError(code, error instanceof Error ? error : undefined);
  }

  // Firestore error
  if (isFirestoreNativeError(error)) {
    const code = mapFirestoreErrorCode(error.code!);
    return new FirestoreError(
      code,
      undefined,
      error instanceof Error ? error : undefined
    );
  }

  // Storage error
  if (isStorageNativeError(error)) {
    const code = mapStorageErrorCode(error.code!.replace("storage/", ""));
    return new StorageError(
      code,
      undefined,
      error instanceof Error ? error : undefined
    );
  }

  // Network error
  if (isNetworkNativeError(error)) {
    return new NetworkError(
      ErrorCode.NETWORK_OFFLINE,
      undefined,
      error instanceof Error ? error : undefined
    );
  }

  // Generic Error object
  if (error instanceof Error) {
    return new AppError(ErrorCode.UNKNOWN, error.message, error);
  }

  // String error
  if (typeof error === "string") {
    return new AppError(ErrorCode.UNKNOWN, error);
  }

  // Unknown error type
  return new AppError(ErrorCode.UNKNOWN, "不明なエラーが発生しました");
}

/**
 * エラーをログ出力
 *
 * @param error - エラー
 * @param context - エラー発生コンテキスト
 */
export function logError(error: AppError, context?: string): void {
  if (!currentOptions.logToConsole) {
    return;
  }

  const logData = {
    context,
    ...error.toJSON(),
  };

  console.error(`[${error.name}]`, JSON.stringify(logData, null, 2));
}

/**
 * エラーをCrashlyticsに報告（将来実装）
 *
 * @param error - エラー
 * @param context - エラー発生コンテキスト
 */
export function reportError(error: AppError, context?: string): void {
  if (!currentOptions.reportToCrashlytics) {
    return;
  }

  // TODO: Firebase Crashlyticsへの報告を実装
  // import crashlytics from '@react-native-firebase/crashlytics';
  // crashlytics().recordError(error, context);

  console.log("[Crashlytics] Would report:", context, error.code);
}

/**
 * エラーを処理してユーザー向けメッセージを取得
 *
 * エラーを正規化し、ログ出力とCrashlytics報告を行った上で、
 * ユーザー向けメッセージを返します。
 *
 * @param error - 元のエラー
 * @param context - エラー発生コンテキスト
 * @returns ユーザー向けメッセージ
 */
export function handleError(error: unknown, context?: string): string {
  const normalizedError = normalizeError(error);

  // Log the error
  logError(normalizedError, context);

  // Report to Crashlytics in production
  reportError(normalizedError, context);

  return normalizedError.userMessage;
}

/**
 * エラーコードからユーザー向けメッセージを取得するヘルパー
 *
 * @param code - エラーコード
 * @returns ユーザー向けメッセージ
 */
export function getErrorMessage(code: string): string {
  return getUserMessage(code);
}

/**
 * 非同期関数をエラーハンドリング付きで実行
 *
 * @param fn - 実行する非同期関数
 * @param context - エラー発生コンテキスト
 * @returns 実行結果またはエラー
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<{ data: T; error: null } | { data: null; error: AppError }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    const normalizedError = normalizeError(error);
    logError(normalizedError, context);
    reportError(normalizedError, context);
    return { data: null, error: normalizedError };
  }
}

/**
 * エラーが再試行可能かどうかを判定
 *
 * ネットワークエラーやサーバーエラーなど、
 * 一時的なエラーは再試行可能と判定します。
 *
 * @param error - エラー
 * @returns 再試行可能かどうか
 */
export function isRetryableError(error: unknown): boolean {
  const normalizedError = normalizeError(error);

  const retryableCodes = [
    ErrorCode.NETWORK_OFFLINE,
    ErrorCode.NETWORK_TIMEOUT,
    ErrorCode.NETWORK_SERVER_ERROR,
    ErrorCode.AUTH_NETWORK_REQUEST_FAILED,
    ErrorCode.AUTH_TOO_MANY_REQUESTS,
    ErrorCode.FIRESTORE_UNAVAILABLE,
    ErrorCode.FIRESTORE_RESOURCE_EXHAUSTED,
  ];

  return retryableCodes.includes(normalizedError.code as ErrorCode);
}

/**
 * エラーが認証エラーかどうかを判定
 *
 * @param error - エラー
 * @returns 認証エラーかどうか
 */
export function isAuthenticationError(error: unknown): boolean {
  const normalizedError = normalizeError(error);
  return normalizedError.code.startsWith("auth/");
}

/**
 * グローバルエラーハンドラーを設定
 *
 * 未処理のPromise rejectionとグローバルエラーを捕捉します。
 */
export function setupGlobalErrorHandler(): void {
  // Check if ErrorUtils is available (React Native environment)
  if (typeof ErrorUtils === "undefined") {
    if (__DEV__) {
      console.log(
        "[ErrorHandler] ErrorUtils not available, skipping global handler setup"
      );
    }
    return;
  }

  // Handle unhandled errors
  const originalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    const normalizedError = normalizeError(error);
    logError(normalizedError, `Global Error (Fatal: ${isFatal})`);
    reportError(normalizedError, `Global Error (Fatal: ${isFatal})`);

    // Call the original handler
    originalHandler?.(error, isFatal);
  });

  if (__DEV__) {
    console.log("[ErrorHandler] Global error handler setup complete");
  }
}
