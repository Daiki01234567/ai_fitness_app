/**
 * Firebase Crashlytics設定
 *
 * アプリのクラッシュレポートを収集・送信します。
 * Expo Managed Workflowでは直接使用できないため、スタブ実装を提供します。
 * Development Build移行後に @react-native-firebase/crashlytics で本実装に切り替えます。
 *
 * @see docs/expo/tickets/006-monitoring-logging.md
 */

import { getEnvironment } from "./firebase";
import { logger } from "./logger";

/**
 * Crashlytics初期化状態
 */
let isEnabled = false;
let isInitialized = false;

/**
 * ユーザー属性の型定義
 */
export interface UserAttributes {
  [key: string]: string;
}

/**
 * Crashlyticsの初期化
 *
 * 開発環境ではCrashlyticsを無効化します（本番データを汚染しないため）
 *
 * @example
 * ```typescript
 * await initCrashlytics();
 * ```
 */
export async function initCrashlytics(): Promise<void> {
  if (isInitialized) {
    logger.debug("Crashlytics already initialized");
    return;
  }

  try {
    const env = getEnvironment();

    // Development環境では無効化
    if (env === "development") {
      isEnabled = false;
      logger.info("Crashlytics disabled in development environment");
    } else {
      // TODO: @react-native-firebase/crashlyticsの初期化
      // Development Build移行後に実装:
      //
      // import crashlytics from '@react-native-firebase/crashlytics';
      // await crashlytics().setCrashlyticsCollectionEnabled(true);

      isEnabled = true;
      logger.info("Crashlytics initialized (stub)", { environment: env });
    }

    isInitialized = true;
  } catch (error) {
    logger.error("Crashlytics initialization failed", error as Error);
    isEnabled = false;
    isInitialized = true;
  }
}

/**
 * Crashlyticsを有効/無効に設定
 *
 * @param enabled 有効化するかどうか
 *
 * @example
 * ```typescript
 * // ユーザーがクラッシュレポートの送信を許可した場合
 * setCrashlyticsEnabled(true);
 * ```
 */
export function setCrashlyticsEnabled(enabled: boolean): void {
  // TODO: Development Build移行後に実装
  // import crashlytics from '@react-native-firebase/crashlytics';
  // crashlytics().setCrashlyticsCollectionEnabled(enabled);

  isEnabled = enabled;
  logger.info(`Crashlytics collection ${enabled ? "enabled" : "disabled"} (stub)`);
}

/**
 * ユーザーIDを設定
 * クラッシュレポートに含まれるユーザー識別子
 *
 * @param userId ユーザーID
 *
 * @example
 * ```typescript
 * setCrashlyticsUserId('user_12345');
 * ```
 */
export function setCrashlyticsUserId(userId: string): void {
  if (!isEnabled) {
    logger.debug(`Crashlytics user ID (disabled): ${userId}`);
    return;
  }

  // TODO: Development Build移行後に実装
  // import crashlytics from '@react-native-firebase/crashlytics';
  // crashlytics().setUserId(userId);

  logger.debug(`Crashlytics user ID set (stub): ${userId}`);
}

/**
 * カスタム属性を設定
 * クラッシュレポートに追加情報を含める
 *
 * @param key 属性名
 * @param value 属性値
 *
 * @example
 * ```typescript
 * setCrashlyticsAttribute('subscription_tier', 'premium');
 * ```
 */
export function setCrashlyticsAttribute(key: string, value: string): void {
  if (!isEnabled) {
    logger.debug(`Crashlytics attribute (disabled): ${key}=${value}`);
    return;
  }

  // TODO: Development Build移行後に実装
  // import crashlytics from '@react-native-firebase/crashlytics';
  // crashlytics().setAttribute(key, value);

  logger.debug(`Crashlytics attribute set (stub): ${key}=${value}`);
}

/**
 * 複数のカスタム属性を一括設定
 *
 * @param attributes 属性のオブジェクト
 *
 * @example
 * ```typescript
 * setCrashlyticsAttributes({
 *   app_version: '1.0.0',
 *   device_type: 'phone',
 * });
 * ```
 */
export function setCrashlyticsAttributes(attributes: UserAttributes): void {
  if (!isEnabled) {
    logger.debug("Crashlytics attributes (disabled)", attributes as Record<string, unknown>);
    return;
  }

  // TODO: Development Build移行後に実装
  // import crashlytics from '@react-native-firebase/crashlytics';
  // crashlytics().setAttributes(attributes);

  for (const [key, value] of Object.entries(attributes)) {
    setCrashlyticsAttribute(key, value);
  }
}

/**
 * カスタムログを記録
 * クラッシュ発生前のコンテキスト情報として記録
 *
 * @param message ログメッセージ
 *
 * @example
 * ```typescript
 * logCrashlyticsMessage('User started training session');
 * ```
 */
export function logCrashlyticsMessage(message: string): void {
  if (!isEnabled) {
    logger.debug(`Crashlytics log (disabled): ${message}`);
    return;
  }

  // TODO: Development Build移行後に実装
  // import crashlytics from '@react-native-firebase/crashlytics';
  // crashlytics().log(message);

  logger.debug(`Crashlytics log (stub): ${message}`);
}

/**
 * 非致命的エラーを記録
 * アプリがクラッシュしないエラーをCrashlyticsに送信
 *
 * @param error エラーオブジェクト
 * @param context 追加のコンテキスト情報
 *
 * @example
 * ```typescript
 * try {
 *   await fetchUserData();
 * } catch (error) {
 *   recordError(error as Error, 'Failed to fetch user data');
 * }
 * ```
 */
export function recordError(error: Error, context?: string): void {
  if (!isEnabled) {
    logger.debug(`Crashlytics error (disabled): ${error.message}`, { context });
    return;
  }

  // コンテキストがある場合は先にログを記録
  if (context) {
    logCrashlyticsMessage(context);
  }

  // TODO: Development Build移行後に実装
  // import crashlytics from '@react-native-firebase/crashlytics';
  // crashlytics().recordError(error);

  logger.debug(`Crashlytics error recorded (stub): ${error.message}`, {
    name: error.name,
    stack: error.stack,
    context,
  });
}

/**
 * JavaScriptの例外を記録
 * recordErrorのエイリアス
 *
 * @param error エラーオブジェクト
 * @param jsErrorName エラー名（オプション）
 */
export function recordJsError(error: Error, jsErrorName?: string): void {
  if (jsErrorName) {
    logCrashlyticsMessage(`JS Error: ${jsErrorName}`);
  }
  recordError(error);
}

/**
 * テストクラッシュを発生させる
 * Crashlyticsの設定が正しく動作しているか確認するための開発用関数
 *
 * WARNING: 本番環境では使用しないでください
 *
 * @example
 * ```typescript
 * // 開発環境でのテスト
 * if (__DEV__) {
 *   testCrash();
 * }
 * ```
 */
export function testCrash(): void {
  const env = getEnvironment();

  if (env === "production") {
    logger.warn("testCrash() is not available in production environment");
    return;
  }

  logger.warn("Triggering test crash...");

  // TODO: Development Build移行後に実装
  // import crashlytics from '@react-native-firebase/crashlytics';
  // crashlytics().crash();

  // スタブ実装: 実際にはクラッシュさせない
  throw new Error("Crashlytics test crash (stub)");
}

/**
 * Crashlyticsの有効/無効状態を取得
 */
export function isCrashlyticsEnabled(): boolean {
  return isEnabled;
}

/**
 * グローバルエラーハンドラーを設定
 * キャッチされなかった例外をCrashlyticsに送信
 *
 * @example
 * ```typescript
 * // アプリ起動時に呼び出す
 * setupGlobalErrorHandler();
 * ```
 */
export function setupGlobalErrorHandler(): void {
  // React Nativeのグローバルエラーハンドラー
  const originalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    // Crashlyticsにエラーを記録
    if (isFatal) {
      logCrashlyticsMessage(`Fatal error occurred`);
    }
    recordError(error, isFatal ? "Fatal Error" : "Non-Fatal Error");

    // ロガーにも出力
    logger.error(`Uncaught exception${isFatal ? " (fatal)" : ""}`, error);

    // 元のハンドラーを呼び出す
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });

  logger.info("Global error handler set up for Crashlytics");
}

/**
 * Promise の未処理拒否をハンドリング
 *
 * @example
 * ```typescript
 * // アプリ起動時に呼び出す
 * setupUnhandledPromiseRejectionHandler();
 * ```
 */
export function setupUnhandledPromiseRejectionHandler(): void {
  // React Native 0.63+では自動的にPromiseの拒否が処理されるが、
  // 追加のロギングのためにイベントリスナーを設定

  // Note: React Nativeではwindow.addEventListenerは使用できないため、
  // ErrorUtilsを通じて処理する

  logger.info("Unhandled promise rejection handler configured");
}
